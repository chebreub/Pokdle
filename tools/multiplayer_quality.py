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
            browser=p.chromium.launch();contexts=[browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce') for _ in range(2)];extra_contexts=[]
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
                wait(host,lambda:host.locator('#party-players li:not(.party-player-empty)').count()==2,'Host roster did not update')

                # Host refresh must preserve ownership instead of transferring the room.
                stage='host-refresh';host.reload(wait_until='domcontentloaded',timeout=45000)
                wait(host,lambda:host.evaluate('() => typeof openPartyRoomMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000'),'Host app did not initialize after refresh')
                wait(host,lambda:host.locator('#party-joined').is_visible(),'Host Party Room was not resumed after refresh')
                wait(host,lambda:host.locator('#party-room-code').inner_text().strip()==code,'Host resumed the wrong room')
                wait(host,lambda:host.evaluate('() => Boolean(partyRoomState.room?.players?.find(p=>p.isSelf)?.isHost)'),'Host ownership was not restored')
                wait(guest,lambda:guest.locator('#party-players li:not(.party-player-empty)').count()==2,'Guest lost host during refresh grace')

                stage='select';host.locator('#party-mode-nearest').click()
                wait(host,lambda:host.locator('#party-mode-nearest').get_attribute('aria-pressed')=='true','Selected mode did not update')
                stage='start';host.locator('#party-start-btn').click()
                host.locator('#party-round').wait_for(state='visible');guest.locator('#party-round').wait_for(state='visible')
                round_number=host.evaluate('() => partyRoomState.room?.roundNumber')

                # Guest refresh in the middle of a live round must restore the same seat and round.
                stage='guest-live-refresh';guest.reload(wait_until='domcontentloaded',timeout=45000)
                wait(guest,lambda:guest.evaluate('() => typeof openPartyRoomMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000'),'Guest app did not initialize after refresh')
                wait(guest,lambda:guest.locator('#party-joined').is_visible(),'Guest Party Room was not resumed after refresh')
                wait(guest,lambda:guest.locator('#party-room-code').inner_text().strip()==code,'Guest resumed the wrong room')
                wait(guest,lambda:guest.evaluate('(roundNumber) => partyRoomState.room?.status==="playing" && partyRoomState.room?.roundNumber===roundNumber',round_number),'Guest did not resume the live round')
                wait(host,lambda:host.locator('#party-players li.is-offline').count()==0,'Guest stayed offline after reconnect')

                for page,name in [(host,'Pikachu'),(guest,'Raichu')]:
                    stage='answer-'+name;page.locator('#party-round').wait_for(state='visible')
                    page.locator('#party-guess').fill(name)
                    page.locator('#party-guess-ac > *').first.wait_for(state='visible');page.locator('#party-guess-ac > *').first.click()
                stage='result';host.locator('#party-nearest-results').wait_for(state='visible');guest.locator('#party-nearest-results').wait_for(state='visible')
                host.screenshot(path=str(out/'host-result.png'));guest.screenshot(path=str(out/'guest-result.png'))
                # Voluntary host departure must hand the salon to the remaining player.
                stage='party-host-handoff';host.locator('[data-action="partyLeaveRoom"]:visible').first.click()
                wait(guest,lambda:guest.locator('#party-players li:not(.party-player-empty)').count()==1,'Party host did not leave roster')
                wait(guest,lambda:guest.evaluate('() => Boolean(partyRoomState.room?.players?.find(p=>p.isSelf)?.isHost)'),'Party host role was not transferred')
                guest.evaluate('() => { if (typeof partyLeaveRoom === "function") partyLeaveRoom(); }')

                # Duel live 1v1: token-based refresh must restore the same live seat.
                stage='duel-open'
                for page in pages:
                    page.evaluate('() => openMultiplayerMode()')
                host.locator('#multiplayer-nickname').fill('QA Duel Host');host.locator('#multiplayer-create-room').click()
                wait(host,lambda:host.evaluate('() => Boolean(multiplayerLiveState?.room?.code)'),'Duel room was not created')
                duel_code=host.evaluate('() => multiplayerLiveState.room.code')
                guest.locator('#multiplayer-nickname').fill('QA Duel Guest');guest.locator('#multiplayer-room-input').fill(duel_code);guest.evaluate('() => joinMultiplayerRoom()')
                wait(host,lambda:host.evaluate('() => multiplayerLiveState?.room?.status==="live"'),'Duel did not start')
                guest_side=guest.evaluate('() => multiplayerLiveState.room.players.find(p=>p.isSelf)?.id')
                stage='duel-refresh';guest.reload(wait_until='domcontentloaded',timeout=45000)
                wait(guest,lambda:guest.evaluate('() => typeof openMultiplayerMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000'),'Duel guest app did not initialize')
                wait(guest,lambda:guest.evaluate('(code) => multiplayerLiveState?.room?.code===code && multiplayerLiveState?.room?.status==="live"',duel_code),'Duel live seat was not resumed')
                wait(guest,lambda:guest.locator('#screen-multiplayer').is_visible(),'Duel screen did not reopen after refresh')
                wait(host,lambda:host.evaluate('() => multiplayerLiveState?.room?.players?.every(p=>p.connected)'),'Duel opponent stayed offline')
                guest.evaluate('() => leaveMultiplayerRoom(true)');host.evaluate('() => leaveMultiplayerRoom(true)')

                # Stat Clash: host ownership and opponent side survive refresh, including a live match.
                stage='clash-open'
                for page in pages: page.evaluate('() => openStatClashMode()')
                host.evaluate('() => { statClashState.roomNameDraft="QA Clash Host"; createStatClashRoom(); }')
                wait(host,lambda:host.evaluate('() => Boolean(statClashState?.room?.code)'),'Stat Clash room was not created')
                clash_code=host.evaluate('() => statClashState.room.code')
                guest.evaluate('(code) => { statClashState.roomNameDraft="QA Clash Guest"; statClashState.roomCodeDraft=code; joinStatClashRoom(); }',clash_code)
                wait(host,lambda:host.evaluate('() => statClashState?.room?.players?.length===2'),'Stat Clash guest did not join')
                host.evaluate('() => selectStatClashImposedRule("noSpeedEarly")')
                guest.evaluate('() => selectStatClashImposedRule("atkRound3")')
                wait(host,lambda:host.evaluate('() => Boolean(statClashState?.room?.pendingImposedRuleBySide?.left && statClashState?.room?.pendingImposedRuleBySide?.right)'),'Stat Clash imposed rules were not selected')
                stage='clash-host-refresh';host.reload(wait_until='domcontentloaded',timeout=45000)
                wait(host,lambda:host.evaluate('() => typeof openStatClashMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000'),'Stat Clash host app did not initialize')
                wait(host,lambda:host.evaluate('(code) => statClashState?.room?.code===code',clash_code),'Stat Clash host room was not resumed')
                wait(host,lambda:host.evaluate('() => Boolean(statClashState?.room?.players?.find(p=>p.isSelf)?.isHost)'),'Stat Clash host ownership was lost')
                wait(host,lambda:host.evaluate('() => Boolean(statClashState?.room?.pendingImposedRuleBySide?.left && statClashState?.room?.pendingImposedRuleBySide?.right)'),'Stat Clash rule choices were lost on refresh')
                host.evaluate('() => startStatClashRoomGame()')
                wait(host,lambda:host.evaluate('() => ["starting","live"].includes(statClashState?.room?.status)'),'Stat Clash did not start')
                clash_guest_side=guest.evaluate('() => statClashState.room.players.find(p=>p.isSelf)?.side')
                stage='clash-guest-refresh';guest.reload(wait_until='domcontentloaded',timeout=45000)
                wait(guest,lambda:guest.evaluate('() => typeof openStatClashMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000'),'Stat Clash guest app did not initialize')
                wait(guest,lambda:guest.evaluate('(args) => statClashState?.room?.code===args[0] && statClashState?.room?.players?.find(p=>p.isSelf)?.side===args[1]',[clash_code,clash_guest_side]),'Stat Clash live seat was not resumed')
                guest.evaluate('() => leaveStatClashRoom()');host.evaluate('() => leaveStatClashRoom()')

                # Stat Auction: a live allocation match must survive a guest refresh on the same side.
                stage='auction-open'
                for page in pages: page.evaluate('() => openStatAuctionMode()')
                host.evaluate('() => { statAuctionState.roomNicknameDraft="QA Auction Host"; createStatAuctionRoom(); }')
                wait(host,lambda:host.evaluate('() => Boolean(statAuctionState?.room?.code)'),'Stat Auction room was not created')
                auction_code=host.evaluate('() => statAuctionState.room.code')
                guest.evaluate('(code) => { statAuctionState.roomNicknameDraft="QA Auction Guest"; statAuctionState.roomDraftCode=code; joinStatAuctionRoom(); }',auction_code)
                wait(host,lambda:host.evaluate('() => statAuctionState?.room?.players?.length===2'),'Stat Auction guest did not join')
                host.evaluate('() => startStatAuctionMatch()')
                wait(host,lambda:host.evaluate('() => statAuctionState?.room?.status==="live"'),'Stat Auction did not start')
                auction_side=guest.evaluate('() => statAuctionState.room.players.find(p=>p.isSelf)?.side')
                stage='auction-guest-refresh';guest.reload(wait_until='domcontentloaded',timeout=45000)
                wait(guest,lambda:guest.evaluate('() => typeof openStatAuctionMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000'),'Stat Auction guest app did not initialize')
                wait(guest,lambda:guest.evaluate('(args) => statAuctionState?.room?.code===args[0] && statAuctionState?.room?.status==="live" && statAuctionState?.room?.players?.find(p=>p.isSelf)?.side===args[1]',[auction_code,auction_side]),'Stat Auction live seat was not resumed')
                guest.evaluate('() => leaveStatAuctionRoom()');host.evaluate('() => leaveStatAuctionRoom()')

                # Isolated Stat Clash host-handoff scenario: fresh sockets avoid polluting production rate limits.
                stage='clash-host-handoff'
                extra_contexts=[browser.new_context(viewport={'width':1280,'height':800},reduced_motion='reduce',extra_http_headers={'X-Forwarded-For':f'198.51.100.{idx}'}) for idx in range(31,34)]
                transfer_pages=[context.new_page() for context in extra_contexts]
                for page in transfer_pages:
                    page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)))
                    page.goto('http://127.0.0.1:3188/',wait_until='domcontentloaded',timeout=45000)
                    wait(page,lambda p=page:p.evaluate('() => typeof openStatClashMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000'),'Transfer Stat Clash client did not initialize')
                    wait(page,lambda p=page:p.evaluate('() => !document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents==="none"'),'Transfer Stat Clash splash stayed visible')
                    wait(page,lambda p=page:p.evaluate('() => Boolean(ensureMultiplayerSocket()?.connected)'),'Transfer Stat Clash socket did not connect')
                    page.evaluate('() => { if (typeof closeOverlayModal === "function") closeOverlayModal(); openStatClashMode(); }')
                transfer_host,transfer_guest,transfer_replacement=transfer_pages
                transfer_host.evaluate('() => { statClashState.roomNameDraft="QA Clash Transfer Host"; createStatClashRoom(); }')
                wait(transfer_host,lambda:transfer_host.evaluate('() => Boolean(statClashState?.room?.code)'),'Transfer Stat Clash room was not created')
                transfer_code=transfer_host.evaluate('() => statClashState.room.code')
                transfer_guest.evaluate('(code) => { statClashState.roomNameDraft="QA Clash Transfer Guest"; statClashState.roomCodeDraft=code; joinStatClashRoom(); }',transfer_code)
                wait(transfer_host,lambda:transfer_host.evaluate('() => statClashState?.room?.players?.length===2'),'Transfer Stat Clash guest did not join')
                transfer_host.evaluate('() => leaveStatClashRoom()')
                wait(transfer_guest,lambda:transfer_guest.evaluate('(code) => statClashState?.room?.code===code && statClashState?.room?.status==="lobby"',transfer_code),'Stat Clash room closed when its host left')
                wait(transfer_guest,lambda:transfer_guest.evaluate('() => Boolean(statClashState?.room?.players?.find(p=>p.isSelf)?.isHost)'),'Stat Clash host role did not transfer')
                transfer_replacement.evaluate('(code) => { statClashState.roomNameDraft="QA Clash Replacement"; statClashState.roomCodeDraft=code; joinStatClashRoom(); }',transfer_code)
                wait(transfer_guest,lambda:transfer_guest.evaluate('() => statClashState?.room?.players?.length===2'),'Replacement Stat Clash player could not join transferred room')
                transfer_guest.evaluate('() => selectStatClashImposedRule("noSpeedEarly")')
                transfer_replacement.evaluate('() => selectStatClashImposedRule("atkRound3")')
                wait(transfer_guest,lambda:transfer_guest.evaluate('() => Boolean(statClashState?.room?.pendingImposedRuleBySide?.left && statClashState?.room?.pendingImposedRuleBySide?.right)'),'Transferred Stat Clash room could not collect fresh rule choices')
                transfer_guest.evaluate('() => startStatClashRoomGame()')
                wait(transfer_guest,lambda:transfer_guest.evaluate('() => ["starting","live"].includes(statClashState?.room?.status)'),'Transferred Stat Clash host could not start the game')
                transfer_replacement.evaluate('() => leaveStatClashRoom()');transfer_guest.evaluate('() => leaveStatClashRoom()')
                for context in extra_contexts: context.close()
                extra_contexts=[]

                # Capacity + continuity: eight fresh browser clients play a round, then continue after host handoff.
                stage='party-8p-boot'
                extra_contexts=[browser.new_context(viewport={'width':1280,'height':800},reduced_motion='reduce',extra_http_headers={'X-Forwarded-For':f'198.51.100.{idx}'}) for idx in range(41,49)]
                crowd=[context.new_page() for context in extra_contexts]
                for page in crowd:
                    page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)))
                    page.goto('http://127.0.0.1:3188/',wait_until='domcontentloaded',timeout=45000)
                    wait(page,lambda p=page:p.evaluate('() => typeof openPartyRoomMode === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length>1000'),'8p client did not initialize')
                    wait(page,lambda p=page:p.evaluate('() => !document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents==="none"'),'8p client splash stayed visible')
                    wait(page,lambda p=page:p.evaluate('() => Boolean(ensureMultiplayerSocket()?.connected)'),'8p client socket did not connect')
                    page.evaluate('() => { if (typeof closeOverlayModal === "function") closeOverlayModal(); openPartyRoomMode(); }')
                crowd_host=crowd[0]
                crowd_host.locator('#party-nickname').fill('QA 8 Host');crowd_host.locator('[data-action="partyCreateRoom"]').click()
                crowd_host.locator('#party-joined').wait_for(state='visible');crowd_code=crowd_host.locator('#party-room-code').inner_text().strip()
                for idx,page in enumerate(crowd[1:],1):
                    page.locator('#party-nickname').fill(f'QA 8 Guest {idx}')
                    page.locator('#party-join-code').fill(crowd_code);page.locator('[data-action="partyJoinRoom"]').click()
                    page.locator('#party-joined').wait_for(state='visible')
                wait(crowd_host,lambda:crowd_host.locator('#party-players li:not(.party-player-empty)').count()==8,'Party Room did not reach eight players')
                for page in crowd:
                    wait(page,lambda p=page:p.evaluate('() => partyRoomState.room?.players?.length===8'),'An 8p client did not receive the full roster')
                stage='party-8p-round';crowd_host.locator('#party-mode-nearest').click()
                wait(crowd_host,lambda:crowd_host.locator('#party-mode-nearest').get_attribute('aria-pressed')=='true','8p mode selection did not update')
                crowd_host.locator('#party-start-btn').click()
                for page in crowd: page.locator('#party-round').wait_for(state='visible')
                crowd_round=crowd_host.evaluate('() => partyRoomState.room?.roundNumber')
                answers=['Pikachu','Raichu','Bulbizarre','Salamèche','Carapuce','Roucool','Rattata','Chenipan']
                for page,name in zip(crowd,answers):
                    page.locator('#party-guess').fill(name)
                    page.locator('#party-guess-ac > *').first.wait_for(state='visible');page.locator('#party-guess-ac > *').first.click()
                for page in crowd: page.locator('#party-nearest-results').wait_for(state='visible')
                crowd_host.screenshot(path=str(out/'party-8p-result.png'))
                stage='party-8p-host-handoff';crowd_host.locator('[data-action="partyLeaveRoom"]:visible').first.click()
                new_host=crowd[1]
                wait(new_host,lambda:new_host.evaluate('() => partyRoomState.room?.players?.length===7'),'8p host did not leave')
                wait(new_host,lambda:new_host.evaluate('() => Boolean(partyRoomState.room?.players?.find(p=>p.isSelf)?.isHost)'),'8p host role was not transferred')
                new_host.evaluate('() => partyNextRound()')
                wait(new_host,lambda:new_host.evaluate('(roundNumber)=>partyRoomState.room?.roundNumber>roundNumber',crowd_round),'New host could not continue the Party Room campaign')
                for page in crowd[1:]:
                    wait(page,lambda p=page,round_number=crowd_round:p.evaluate('(n)=>partyRoomState.room?.roundNumber>n',round_number),'A remaining 8p client did not receive the next round')
                for page in crowd[1:]: page.evaluate('() => { if (typeof partyLeaveRoom === "function") partyLeaveRoom(); }')
                for context in extra_contexts: context.close()
                extra_contexts=[]

                assert not errors,repr(errors)
                result['ok']=True;result['clients']=8;result['checks']=['party create/join','party host refresh resume','party live-round guest refresh','party shared result','party voluntary host handoff','party eight-player roster','party eight-player shared result','party campaign continues after host handoff','duel token refresh resume','duel live seat preserved','stat clash host refresh','stat clash live guest refresh','stat clash lobby host handoff','stat clash transferred room restart','stat auction live guest refresh','explicit leave paths']
            except Exception:
                for i,page in enumerate(pages):
                    try:page.screenshot(path=str(out/f'failure-{i}.png'))
                    except Exception:pass
                raise
            finally:
                for context in extra_contexts:
                    try: context.close()
                    except Exception: pass
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
