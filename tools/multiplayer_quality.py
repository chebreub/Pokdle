"""Two real browser sessions against an isolated local Party Room server."""
import argparse,json,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='quality-artifacts/multiplayer');args=parser.parse_args()
    out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True);result={'ok':False,'clients':2,'scope':'local guest Party Room'}
    log=(out/'server.log').open('w');server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',stdout=log,stderr=subprocess.STDOUT,env=dict(os.environ,PORT='3188',DATABASE_URL='',DISCORD_CLIENT_ID='',DISCORD_CLIENT_SECRET=''))
    try:
        for _ in range(80):
            try:urllib.request.urlopen('http://127.0.0.1:3188/',timeout=2).close();break
            except Exception:time.sleep(.25)
        with sync_playwright() as p:
            browser=p.chromium.launch();contexts=[browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce') for _ in range(2)]
            host,guest=[context.new_page() for context in contexts];errors=[]
            for page in [host,guest]:
                page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto('http://127.0.0.1:3188/',wait_until='domcontentloaded',timeout=45000)
                page.wait_for_function('typeof openPartyRoomMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000')
                page.wait_for_function('!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents==="none"',timeout=20000)
                page.evaluate('closeOverlayModal(); openPartyRoomMode();')
            host.locator('#party-nickname').fill('QA Host');host.locator('[data-action="partyCreateRoom"]').click()
            host.locator('#party-joined').wait_for(state='visible');code=host.locator('#party-room-code').inner_text().strip()
            assert code and code!='—','No room code'
            guest.locator('#party-nickname').fill('QA Guest');guest.locator('#party-join-code').fill(code);guest.locator('[data-action="partyJoinRoom"]').click()
            guest.locator('#party-joined').wait_for(state='visible')
            host.wait_for_function('document.querySelectorAll("#party-players li").length===2')
            host.locator('#party-mode-nearest').click();host.wait_for_function('document.getElementById("party-mode-nearest").getAttribute("aria-pressed")==="true"')
            host.locator('#party-start-btn').click()
            for page,name in [(host,'Pikachu'),(guest,'Raichu')]:
                page.locator('#party-round').wait_for(state='visible')
                page.locator('#party-guess').fill(name)
                page.locator('#party-guess-ac > *').first.wait_for(state='visible')
                page.locator('#party-guess-ac > *').first.click()
            host.locator('#party-nearest-results').wait_for(state='visible');guest.locator('#party-nearest-results').wait_for(state='visible')
            host.screenshot(path=str(out/'host-result.png'));guest.screenshot(path=str(out/'guest-result.png'))
            guest.locator('[data-action="partyLeaveRoom"]:visible').first.click()
            host.wait_for_function('document.querySelectorAll("#party-players li").length===1')
            assert not errors,repr(errors)
            result['ok']=True;result['checks']=['create','join','two-player roster','host mode selection','start','both answers via autocomplete','shared result','explicit leave']
            for context in contexts:context.close()
            browser.close()
    except Exception as e:result['error']=str(e)[:1600]
    finally:
        server.terminate()
        try:server.wait(timeout=5)
        except subprocess.TimeoutExpired:server.kill()
        log.close();(out/'report.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print('MULTIPLAYER_QA '+json.dumps(result),flush=True)
    if not result['ok']:raise SystemExit(1)
if __name__=='__main__':main()
