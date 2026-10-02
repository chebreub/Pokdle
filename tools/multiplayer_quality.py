"""Two guest browser sessions; isolated server; respects the production CSP."""
import argparse,json,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='quality-artifacts/multiplayer');args=parser.parse_args()
    out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True);result={'ok':False,'clients':2,'scope':'local guest Party Room'};stage='server';pages=[]
    log=(out/'server.log').open('w');server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',stdout=log,stderr=subprocess.STDOUT,env=dict(os.environ,PORT='3188',DATABASE_URL='',DISCORD_CLIENT_ID='',DISCORD_CLIENT_SECRET=''))
    def wait(page,predicate,message,timeout=20):
        end=time.monotonic()+timeout
        while time.monotonic()<end:
            if predicate():return
            page.wait_for_timeout(100)
        raise AssertionError(message)
    try:
        for _ in range(80):
            try:urllib.request.urlopen('http://127.0.0.1:3188/',timeout=2).close();break
            except Exception:
                if server.poll() is not None:raise RuntimeError('QA server exited')
                time.sleep(.25)
        else:raise RuntimeError('QA server did not start')
        with sync_playwright() as p:
            browser=p.chromium.launch();contexts=[browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce') for _ in range(2)]
            host,guest=pages=[context.new_page() for context in contexts];errors=[]
            try:
                for page in pages:
                    stage='boot';page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)))
                    page.goto('http://127.0.0.1:3188/',wait_until='domcontentloaded',timeout=45000)
                    wait(page,lambda:page.evaluate('() => typeof openPartyRoomMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000'),'App did not initialize')
                    wait(page,lambda:page.evaluate('() => !document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents==="none"'),'Splash stayed visible')
                    page.evaluate('() => { closeOverlayModal(); openPartyRoomMode(); }')
                stage='create';host.locator('#party-nickname').fill('QA Host');host.locator('[data-action="partyCreateRoom"]').click()
                host.locator('#party-joined').wait_for(state='visible');code=host.locator('#party-room-code').inner_text().strip()
                assert code and code!='—','No room code'
                stage='join';guest.locator('#party-nickname').fill('QA Guest');guest.locator('#party-join-code').fill(code);guest.locator('[data-action="partyJoinRoom"]').click()
                guest.locator('#party-joined').wait_for(state='visible')
                wait(host,lambda:host.locator('#party-players li').count()==2,'Host roster did not update')
                stage='select';host.locator('#party-mode-nearest').click()
                wait(host,lambda:host.locator('#party-mode-nearest').get_attribute('aria-pressed')=='true','Selected mode did not update')
                stage='start';host.locator('#party-start-btn').click()
                for page,name in [(host,'Pikachu'),(guest,'Raichu')]:
                    stage='answer-'+name;page.locator('#party-round').wait_for(state='visible')
                    page.locator('#party-guess').fill(name)
                    page.locator('#party-guess-ac > *').first.wait_for(state='visible');page.locator('#party-guess-ac > *').first.click()
                stage='result';host.locator('#party-nearest-results').wait_for(state='visible');guest.locator('#party-nearest-results').wait_for(state='visible')
                host.screenshot(path=str(out/'host-result.png'));guest.screenshot(path=str(out/'guest-result.png'))
                stage='leave';guest.locator('[data-action="partyLeaveRoom"]:visible').first.click()
                wait(host,lambda:host.locator('#party-players li').count()==1,'Guest did not leave roster')
                assert not errors,repr(errors)
                result['ok']=True;result['checks']=['create','join','two-player roster','host mode selection','start','both answers via autocomplete','shared result','explicit leave']
            except Exception:
                for i,page in enumerate(pages):
                    try:page.screenshot(path=str(out/f'failure-{i}.png'))
                    except Exception:pass
                raise
            finally:
                for context in contexts:context.close()
                browser.close()
    except Exception as e:result.update(stage=stage,error=str(e)[:1600])
    finally:
        server.terminate()
        try:server.wait(timeout=5)
        except subprocess.TimeoutExpired:server.kill()
        log.close();(out/'report.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print('MULTIPLAYER_QA '+json.dumps(result),flush=True)
    if not result['ok']:raise SystemExit(1)
if __name__=='__main__':main()
