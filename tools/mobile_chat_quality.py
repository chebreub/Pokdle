"""MOB-03: local two-player chat, simulated visual viewport, real coordinate taps.

The viewport override exercises keyboard resize/pan handling; it is not a real
OS keyboard or a physical iPhone test. No production service is used.
"""
from contextlib import contextmanager
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'mobile-chat'
URL = 'http://127.0.0.1:3195/'


def ready(page, expression):
    page.wait_for_function('() => (' + expression + ')', timeout=15000)


def viewport(page, height=None, offset=0):
    page.evaluate('''({height,offset}) => {
      const v=window.visualViewport;
      if(height===null) { delete v.height; delete v.offsetTop; }
      else {
        Object.defineProperty(v,'height',{configurable:true,value:height});
        Object.defineProperty(v,'offsetTop',{configurable:true,value:offset});
      }
      v.dispatchEvent(new Event('resize'));
      v.dispatchEvent(new Event('scroll'));
    }''', {'height': height, 'offset': offset})


def target(page, selector, tap=False):
    info = page.locator(selector).evaluate('''el => {
      const r=el.getBoundingClientRect(),v=visualViewport;
      const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
      return {top:r.top,bottom:r.bottom,x,y,height:r.height,width:r.width,
        viewportTop:v.offsetTop,viewportBottom:v.offsetTop+v.height,
        reachable:!!hit&&el.contains(hit)};
    }''')
    assert info['top'] >= info['viewportTop'] - 1, (selector, info)
    assert info['bottom'] <= info['viewportBottom'] + 1, (selector, info)
    assert info['reachable'], (selector, info)
    if tap:
        if page.evaluate('innerWidth <= 640'):
            page.touchscreen.tap(info['x'], info['y'])
        else:
            page.mouse.click(info['x'], info['y'])
    return info


def boot(page, nickname):
    page.goto(URL, wait_until='domcontentloaded')
    ready(page, 'typeof openPartyRoomMode === "function" && POKEMON_LIST.length>1000')
    ready(page, '!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
    page.evaluate('closeOverlayModal();openPartyRoomMode()')
    page.locator('#party-nickname').fill(nickname)


def case(browser, engine, width, height):
    contexts = [browser.new_context(viewport={'width':width,'height':height},
        is_mobile=width<=640, has_touch=width<=640) for _ in range(2)]
    host, guest = [c.new_page() for c in contexts]
    evidence = []
    try:
        boot(host, 'ChatHost'); boot(guest, 'ChatGuest')
        host.locator('[data-action="partyCreateRoom"]').click()
        host.locator('#party-chat-fab').wait_for(state='visible')
        code = host.locator('#party-room-code').inner_text().strip()
        guest.locator('#party-join-code').fill(code)
        guest.locator('[data-action="partyJoinRoom"]').click()
        ready(host, 'partyRoomState.room?.players.length===2')
        host.locator('#party-chat-fab').click()
        guest.locator('#party-chat-fab').click()
        host.locator('#party-chat-input').fill('Message QA mobile')
        assert host.locator('link[href*="dist/app.min.css"]').count() == 1
        scroll_before = host.evaluate('scrollY')
        sizes = [(260,0),(320,0),(400,0),(320,75)] if width <= 640 else [(height,0)]
        for visible_height, offset in sizes:
            viewport(host, visible_height, offset)
            for selector in ['.pchat-x', '.pchat-react button', '#party-chat-input', '#party-chat-form button']:
                # Check each reaction, not just the first match.
                for index in range(host.locator(selector).count()):
                    selected = selector + f':nth-of-type({index+1})' if selector == '.pchat-react button' else selector
                    evidence.append(target(host, selected))
            assert host.locator('#party-chat-input').input_value() == 'Message QA mobile'
            assert host.evaluate('scrollY') == scroll_before, 'viewport handler scrolled the game'
            if width<=640:
                assert host.evaluate('document.body.classList.contains("mobile-keyboard-open")')
        viewport(host, 400 if width<=640 else height)
        host.screenshot(path=str(OUT/f'{engine}-{width}-chat.png'))
        target(host, '#party-chat-form button', tap=True)
        ready(guest, 'partyChat.messages.some(m=>m.text === "Message QA mobile")')
        ready(host, 'document.getElementById("party-chat-input").value === ""')
        target(host, '.pchat-react button:first-child', tap=True)
        ready(guest, 'partyChat.messages.some(m=>m.reaction === "😂")')
        # V2-SOC-01 : comme la discussion entre amis, un numéro, une adresse ou une autre appli est refusé par le
        # serveur et n'arrive jamais chez l'autre joueur ; les noms de Pokémon passent.
        for blocked in ['appelle-moi au 06 12 34 56 78', 'toto.kayan@gmail.com', 'ajoute moi sur snap']:
            # Efface le message d'erreur précédent (état et écran) avant d'envoyer le suivant.
            host.evaluate('partyChat.error = ""; document.getElementById("party-chat-error").textContent = ""')
            host.locator('#party-chat-input').fill(blocked)
            target(host, '#party-chat-form button', tap=True)
            ready(host, 'partyChat.error.length > 0 && document.getElementById("party-chat-error").textContent.length > 0')
        host.evaluate('partyChat.error = ""; document.getElementById("party-chat-error").textContent = ""')
        host.locator('#party-chat-input').fill("C'est Ho-Oh ou Porygon-Z ?")
        target(host, '#party-chat-form button', tap=True)
        ready(guest, "partyChat.messages.some(m=>m.text === \"C'est Ho-Oh ou Porygon-Z ?\")")
        assert not guest.evaluate('partyChat.messages.some(m=>/06 12|gmail|snap/.test(m.text||""))'), 'a refused message reached the other player'
        viewport(host)
        target(host, '.pchat-x', tap=True)
        ready(host, 'document.getElementById("party-chat").classList.contains("hidden")')
        ready(host, '!document.body.classList.contains("mobile-keyboard-open")')
        host.locator('#party-chat-fab').click()
        target(host, '#party-chat-form button')
        if width > 640:
            assert host.locator('#party-chat').evaluate('el=>Math.round(el.getBoundingClientRect().width)') == 360
        return evidence
    except Exception:
        host.screenshot(path=str(OUT/f'{engine}-{width}-failure.png'))
        guest.screenshot(path=str(OUT/f'{engine}-{width}-guest-failure.png'))
        raise
    finally:
        for c in contexts: c.close()


def celebration_case(browser, engine):
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page()
    try:
        boot(page,'QueueQA')
        page.locator('[data-action="partyCreateRoom"]').click()
        page.locator('#party-chat-fab').wait_for(state='visible')
        page.locator('#party-chat-fab').click()
        # Lobby is normally not a calm screen. Permit it in this test only to
        # isolate the chat blocker; production's game-running gate is unchanged.
        page.evaluate('CELEBRATION_CALM_SCREENS.add("screen-party-room");celebrateLevelUp(9,10);celebrateAchievements([{title:"QA",desc:"Local"}])')
        page.wait_for_timeout(1100)
        assert page.locator('.lvc-back,.achc').count()==0
        assert page.evaluate('celebrationQueue.length')==2
        page.locator('#party-chat-input').fill('Brouillon conservé')
        viewport(page,320)
        target(page,'.pchat-x',tap=True)
        viewport(page)
        page.locator('.lvc-back').wait_for(state='visible')
        assert page.locator('.achc').count()==0
        page.locator('.lvc-btn').click()
        page.locator('.achc').wait_for(state='visible')
        page.locator('.achc').click()
        page.locator('.achc').wait_for(state='detached')
        page.locator('#party-chat-fab').click()
        assert page.locator('#party-chat-input').input_value()=='Brouillon conservé'
        target(page,'.pchat-x',tap=True)
        ready(page,'!document.body.classList.contains("mobile-keyboard-open")')
        # Keyboard alone, without a chat overlay, also delays celebrations.
        page.evaluate('showScreen("screen-config")')
        page.evaluate('''() => {
          const input=document.createElement('input');input.type='text';input.id='qa-keyboard';
          document.getElementById('screen-config').prepend(input);input.focus();
        }''')
        viewport(page,320)
        page.evaluate('celebrateLevelUp(10,11)')
        page.wait_for_timeout(1100)
        assert page.locator('.lvc-back,.achc').count()==0
        assert page.evaluate('celebrationQueue.length')==1
        page.evaluate('document.getElementById("qa-keyboard").blur()')
        viewport(page)
        page.locator('.lvc-back').wait_for(state='visible')
        page.locator('.lvc-btn').click()
    except Exception:
        page.screenshot(path=str(OUT/f'{engine}-queue-failure.png'))
        raise
    finally:
        context.close()


@contextmanager
def local_server(engine):
    # Chromium and WebKit are independent player populations. A shared server
    # would count 14 room joins/creates on one IP inside the 30s production
    # anti-abuse window (10 allowed), making the second engine fail at setup.
    # Restart the LOCAL server between engines; keep every rate limit intact.
    with (OUT/f'{engine}-server.log').open('w') as log:
        server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',stdout=log,stderr=subprocess.STDOUT,
            env=dict(os.environ,PORT='3195',DATABASE_URL='',DISCORD_CLIENT_ID='',DISCORD_CLIENT_SECRET=''))
        try:
            for _ in range(80):
                try: urllib.request.urlopen(URL,timeout=2).close();break
                except Exception:
                    if server.poll() is not None: raise RuntimeError('QA server exited')
                    time.sleep(.25)
            else: raise RuntimeError('QA server did not start')
            yield
        finally:
            server.terminate();server.wait(timeout=10)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    results=[]
    try:
        with sync_playwright() as pw:
            for engine in os.getenv('QA_BROWSERS','chromium,webkit').split(','):
                with local_server(engine):
                    browser=getattr(pw,engine).launch()
                    try:
                        for width,height in [(360,740),(390,844),(1366,768)]:
                            evidence=case(browser,engine,width,height)
                            results.append({'engine':engine,'width':width,'ok':True,'targets':evidence})
                        celebration_case(browser,engine)
                        results.append({'engine':engine,'celebrations':True,'ok':True})
                    finally: browser.close()
    finally:
        (OUT/'report.json').write_text(json.dumps(results,indent=2))
    print(json.dumps([dict((k,v) for k,v in r.items() if k!='targets') for r in results]))

if __name__=='__main__': main()
