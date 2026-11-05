"""Exercise real hit targets in mobile game views, on LOCAL synthetic guest sessions.

Playwright locator.click()/tap() auto-scroll targets and can hide the reported
problem. This suite checks document.elementFromPoint at viewport coordinates,
then issues a raw touch/mouse at the same coordinates. It never uses production.
"""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "quality-artifacts" / "mobile-touch"
URL = "http://127.0.0.1:3197/"


def tap_at_point(page, selector, method, index=0):
    # Bring the button into view without auto-scrolling during the actual tap.
    info = page.evaluate("""({selector,index}) => {
      const all = document.querySelectorAll(selector);
      const el = all[index < 0 ? all.length + index : index];
      if (!el || el.disabled) return {error:'missing target',selector};
      el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      const center = el.getBoundingClientRect();
      const desired = innerHeight * (innerWidth < 640 ? .70 : .55);
      window.scrollBy({top:center.top+center.height/2-desired,behavior:'instant'});
      const r = el.getBoundingClientRect();
      const x = Math.round(r.left + r.width/2);
      const y = Math.round(r.top + r.height/2);
      const top = document.elementFromPoint(x,y);
      const chain = document.elementsFromPoint(x,y).slice(0,5).map(n =>
        n.tagName.toLowerCase() + (n.id ? '#'+n.id : '') +
        (typeof n.className === 'string' ? '.'+n.className.trim().replace(/\s+/g,'.') : ''));
      return {
        selector, x, y, viewportWidth:innerWidth, viewportHeight:innerHeight,
        target:el.tagName.toLowerCase() + '.' + el.className,
        hit:Boolean(top && (el===top || el.contains(top))),
        top:top ? top.tagName.toLowerCase()+(top.id ? '#'+top.id : '') : 'none',
        chain, disabled:el.disabled,
        css:{pointerEvents:getComputedStyle(el).pointerEvents, visibility:getComputedStyle(el).visibility},
        scrollY:scrollY, viewport:{height:visualViewport?.height||innerHeight,offsetTop:visualViewport?.offsetTop||0}
      };
    }""", {"selector":selector,"index":index})
    assert not info.get('error'), info
    assert 0 <= info['x'] < info['viewportWidth'] and 0 <= info['y'] < info['viewportHeight'], info
    assert info['hit'], 'Blocked hit target: ' + json.dumps(info, ensure_ascii=False)
    if method == 'touch':
        page.touchscreen.tap(info['x'], info['y'])
    else:
        page.mouse.click(info['x'], info['y'])
    return info


def case(page, engine, width, height):
    page.goto(URL, wait_until='domcontentloaded', timeout=45000)
    page.wait_for_function('typeof openQuiEstCeMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length > 1000', timeout=45000)
    page.wait_for_function('!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"',timeout=20000)
    page.evaluate('''() => { closeOverlayModal(); openQuiEstCeMode(); }''')
    page.locator('#screen-qui-est-ce').wait_for(state='visible')
    page.locator('#screen-qui-est-ce .qui-card:not(:disabled)').first.wait_for(state='visible')
    method = 'touch' if width < 640 else 'mouse'
    steps = []

    # A card on the first and last rows; selecting either should update state.
    for n in (0, 23):
        selector = f'#screen-qui-est-ce .qui-card:nth-child({n+1}):not(:disabled)'
        btn = page.locator(selector)
        expected = int(json.loads(btn.get_attribute('data-args'))[0])
        detail = tap_at_point(page, selector, method)
        assert page.evaluate('quiEstCeState.selected') == expected, f'Card {n+1} touch was ignored: {detail}'
        steps.append(dict(action='select-card', target=n+1, **detail))

    # Questions live in a nested scroll container. Check top and lower buttons.
    for index in (0, -1):
        # The first question can already identify a unique Pokemon; use a fresh
        # board for the second gesture instead of relying on random outcomes.
        if index == -1:
            page.evaluate('restartQuiEstCe()')
        selector = '#screen-qui-est-ce .qui-questions .qui-question:not(:disabled)'
        before = page.evaluate('quiEstCeState.questions')
        detail = tap_at_point(page, selector, method, index=index)
        after = page.evaluate('quiEstCeState.questions')
        assert after == before + 1, f'Question index {index} touch was ignored: {detail}'
        steps.append(dict(action='ask-question', target=index, **detail))

    # On a small screen at least one game action must be tested in lower half.
    if width < 640:
        lower = [step for step in steps if step['y'] >= height * .60]
        assert lower, 'No gameplay target was sampled in the lower viewport; test is inconclusive: ' + json.dumps(steps)

    # Closing and reopening the game must not leave a stale invisible overlay.
    page.evaluate('''() => { goToConfig(); openQuiEstCeMode(); restartQuiEstCe(); }''')
    selector = '#screen-qui-est-ce .qui-card:nth-child(2):not(:disabled)'
    detail = tap_at_point(page, selector, method)
    steps.append(dict(action='after-navigation', **detail))
    return steps


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    reports=[]
    with (OUT / 'server.log').open('w') as logfile:
        proc=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',stdout=logfile,stderr=subprocess.STDOUT,
                              env=dict(os.environ, PORT='3197',DATABASE_URL='',DISCORD_CLIENT_ID='',DISCORD_CLIENT_SECRET=''))
        try:
            for _ in range(80):
                try:
                    urllib.request.urlopen(URL, timeout=2).close()
                    break
                except Exception:
                    if proc.poll() is not None: raise RuntimeError('Local QA server exited')
                    time.sleep(.25)
            else: raise RuntimeError('Local QA server did not start')
            with sync_playwright() as pw:
                for engine in ('chromium','webkit'):
                    browser=getattr(pw,engine).launch()
                    try:
                        for width,height in ((360,780),(390,844),(1366,768)):
                            mobile=width<640
                            ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
                            page=ctx.new_page()
                            entry={'engine':engine,'width':width,'height':height,'ok':False}
                            try:
                                entry['steps']=case(page,engine,width,height)
                                entry['ok']=True
                            except Exception as exc:
                                entry['error']=str(exc)[:2500]
                                try: page.screenshot(path=str(OUT / f'{engine}-{width}-failure.png'),full_page=True,animations='disabled')
                                except Exception: pass
                            finally: ctx.close()
                            reports.append(entry)
                            print('MOBILE_TOUCH_QA '+json.dumps(entry,ensure_ascii=False),flush=True)
                    finally: browser.close()
        finally:
            proc.terminate()
            try: proc.wait(timeout=5)
            except subprocess.TimeoutExpired: proc.kill()
    (OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf8')
    if any(not item['ok'] for item in reports): raise SystemExit(1)


if __name__=='__main__': main()
