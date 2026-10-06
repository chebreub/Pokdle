"""Real two-player type-combo journey with touch input; isolated guest server."""
import json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'party-mobile'
OUT.mkdir(parents=True, exist_ok=True)

def tap(page, selector):
    button = page.locator(selector)
    button.scroll_into_view_if_needed()
    detail = button.evaluate('''e => {
      const r=e.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
      const hit=document.elementFromPoint(x,y), ancestors=[];
      for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);ancestors.push({
        tag:p.id||p.className,transform:s.transform,filter:s.filter,
        backdrop:s.backdropFilter,position:s.position,z:s.zIndex,overflow:s.overflow,
        pointer:s.pointerEvents,animation:s.animationName});}
      return {rect:{x:r.x,y:r.y,w:r.width,h:r.height},viewport:innerHeight,
        reachable:!!hit&&e.contains(hit),hit:hit?.outerHTML.slice(0,300),ancestors};
    }''')
    assert detail['reachable'], json.dumps(detail)
    button.tap(timeout=5000)

def ready(page, expression):
    page.wait_for_function('() => (' + expression + ')', timeout=15000)

results=[]
log=(OUT/'server.log').open('w')
server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',stdout=log,stderr=subprocess.STDOUT,
    env=dict(os.environ,PORT='3189',DATABASE_URL='',DISCORD_CLIENT_ID='',DISCORD_CLIENT_SECRET=''))
try:
    for _ in range(80):
        try:
            urllib.request.urlopen('http://127.0.0.1:3189/',timeout=2).close();break
        except Exception:
            if server.poll() is not None: raise RuntimeError('QA server exited')
            time.sleep(.25)
    else: raise RuntimeError('QA server did not start')
    with sync_playwright() as pw:
        for engine in ['chromium','webkit']:
            browser=getattr(pw,engine).launch()
            for width,height in [(390,844),(360,740)]:
                contexts=[];pages=[];stage='boot';case={'engine':engine,'width':width,'ok':False}
                try:
                    for nickname in ['Host','Guest']:
                        context=browser.new_context(viewport={'width':width,'height':height},
                            is_mobile=True,has_touch=True,reduced_motion='no-preference')
                        contexts.append(context);page=context.new_page();pages.append(page)
                        page.set_default_timeout(8000)
                        page.goto('http://127.0.0.1:3189/',wait_until='domcontentloaded')
                        ready(page,'typeof openPartyRoomMode === "function" && POKEMON_LIST.length>1000')
                        ready(page,'!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                        page.evaluate('closeOverlayModal();openPartyRoomMode()')
                        page.locator('#party-nickname').fill(nickname)
                    host,guest=pages
                    stage='create';tap(host,'[data-action="partyCreateRoom"]')
                    host.locator('#party-joined').wait_for(state='visible')
                    code=host.locator('#party-room-code').inner_text().strip()
                    guest.locator('#party-join-code').fill(code);tap(guest,'[data-action="partyJoinRoom"]')
                    ready(host,'partyRoomState.room?.players?.length===2')
                    stage='select';tap(host,'#party-mode-typecombo')
                    ready(host,'partyRoomState.room?.gameMode === "typecombo"')
                    host.screenshot(path=str(OUT/f'{engine}-{width}-start.png'))
                    stage='start';tap(host,'#party-start-btn')
                    for page in pages: ready(page,'partyRoomState.room?.status === "playing"')
                    stage='answer'
                    answer=host.evaluate('''() => {
                      const ts=partyRoomState.room.round.types;
                      return POKEMON_LIST.find(p=>!p.isAltForm&&partyRoomState.room.selectedGens.includes(p.gen)&&
                        [p.type1,p.type2||p.type1].sort().join('|')===[...ts].sort().join('|'))?.name;
                    }''')
                    assert answer,'No valid synthetic answer'
                    host.locator('#party-guess').fill(answer)
                    host.locator('#party-guess-ac > *').first.wait_for(state='visible')
                    host.locator('#party-guess-ac > *').first.tap()
                    for page in pages: ready(page,'partyRoomState.room?.status === "finished"')
                    # Return from the input/keyboard before using the host actions.
                    host.evaluate('document.activeElement?.blur()')
                    host.screenshot(path=str(OUT/f'{engine}-{width}-result.png'))
                    round_no=host.evaluate('partyRoomState.room.roundNumber')
                    stage='next';tap(host,'#party-room-next-btn')
                    for page in pages: ready(page,f'partyRoomState.room?.status === "playing" && partyRoomState.room.roundNumber === {round_no+1}')
                    case['ok']=True
                except Exception as error:
                    case.update(stage=stage,error=str(error))
                    if pages:
                        pages[0].screenshot(path=str(OUT/f'{engine}-{width}-failure.png'))
                finally:
                    for context in contexts: context.close()
                    results.append(case);print('PARTY_MOBILE '+json.dumps(case),flush=True)
            browser.close()
finally:
    server.terminate()
    try: server.wait(timeout=5)
    except subprocess.TimeoutExpired: server.kill()
    log.close();(OUT/'report.json').write_text(json.dumps(results,indent=2))
if len(results)!=4 or not all(r['ok'] for r in results): raise SystemExit(1)
