"""MOB-03: Party/Duel real guest rooms and friend-link picker, keyboard simulated.

Coordinate taps never auto-scroll the tested target. Real iPhone/Safari remains
separate. A fresh LOCAL server per viewport avoids cross-case anti-abuse hits.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
import mobile_chat_quality as qa

OUT = qa.ROOT / 'quality-artifacts' / 'mobile-controls'


def settle(page):
    page.evaluate('() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')


def fit_check(page, field, list_id, action, width):
    input=page.locator('#'+field)
    input.fill('sa')
    settle(page)
    if width>640:
        input.evaluate('e=>e.scrollIntoView({block:"center",behavior:"instant"})')
    if width<=640:
        for height,offset in [(400,0),(320,0),(260,0),(320,60)]:
            qa.viewport(page,height,offset);settle(page)
            qa.target(page,'#'+field)
            if action:qa.target(page,action)
            # Enough space for at least one complete touch suggestion.
            box=page.locator('#'+list_id).bounding_box()
            assert box and box['height']>=56,(field,height,box)
            qa.target(page,'#'+list_id)
            before=page.evaluate('scrollY')
            pos=page.locator(action or '#'+field).bounding_box()['y']
            for query in ['s','sala','zzzzzz','sa']:
                input.fill(query);settle(page)
                assert abs(page.evaluate('scrollY')-before)<2,(field,'scroll during typing')
                assert abs(page.locator(action or '#'+field).bounding_box()['y']-pos)<2,(field,'action moved')
            assert page.locator('#'+list_id+' .ac-item').count()>0
        qa.viewport(page,400);settle(page)
    qa.target(page,'#'+list_id+' .ac-item:first-child')


def count_emits(page):
    page.evaluate('''() => {
      window.qaEmits=[];const socket=ensureMultiplayerSocket(),emit=socket.emit;
      socket.emit=function(name,...args){qaEmits.push(name);return emit.call(this,name,...args)};
    }''')


def scenario(browser,engine,width,height):
    contexts=[browser.new_context(viewport={'width':width,'height':height},is_mobile=width<=640,has_touch=width<=640) for _ in range(2)]
    host,guest=[c.new_page() for c in contexts]
    stage='boot'
    try:
        qa.boot(host,'ControlsHost');qa.boot(guest,'ControlsGuest')
        count_emits(host)
        host.evaluate('partyCreateRoom()');qa.ready(host,'partyRoomState.room?.code')
        guest.locator('#party-join-code').fill(host.evaluate('partyRoomState.code'));guest.evaluate('partyJoinRoom()')
        qa.ready(host,'partyRoomState.room.players.length===2')
        host.evaluate('partySetMode("deduction")');qa.ready(host,'partyRoomState.room.gameMode==="deduction"')
        host.evaluate('partyStartGame()');qa.ready(host,'partyRoomState.room.status==="playing"')
        stage='party'
        fit_check(host,'party-guess','party-guess-ac','#party-submit-btn',width)
        host.screenshot(path=str(OUT/f'{engine}-{width}-party.png'))
        qa.target(host,'#party-guess-ac .ac-item:first-child',tap=True)
        qa.ready(host,'partyRoomState.room.players.find(p=>p.isSelf)?.attempts===1')
        assert host.evaluate('qaEmits.filter(n=>n==="party:submit-answer").length')==1
        qa.viewport(host)
        # Existing abandon disclosure must remain a confirmation, not an action.
        if host.locator('#party-deduction-forfeit').is_visible():
            host.locator('#party-deduction-forfeit summary').click()
            assert host.locator('#party-deduction-forfeit-btn').is_visible()
            assert host.evaluate('qaEmits.filter(n=>n==="party:forfeit-deduction").length')==0
            host.locator('#party-deduction-forfeit summary').click()
        for page in [host,guest]:page.evaluate('partyLeaveRoom();openMultiplayerMode()')
        stage='duel'
        host.evaluate('createMultiplayerRoom()');qa.ready(host,'multiplayerLiveState.room?.code')
        guest.locator('#multiplayer-room-input').fill(host.evaluate('multiplayerLiveState.room.code'))
        guest.evaluate('joinMultiplayerRoom()');qa.ready(host,'multiplayerLiveState.room?.status==="live"')
        fit_check(host,'multiplayer-guess-input','multiplayer-guess-ac','[data-action="submitMultiplayerGuess"]',width)
        host.screenshot(path=str(OUT/f'{engine}-{width}-duel.png'))
        # Explicit submit button works when the input contains an exact name.
        name=host.locator('#multiplayer-guess-ac .ac-name').first.inner_text()
        host.locator('#multiplayer-guess-input').fill(name);settle(host)
        qa.target(host,'[data-action="submitMultiplayerGuess"]',tap=True)
        qa.ready(host,'multiplayerLiveState.room.players.find(p=>p.isSelf)?.attempts===1')
        assert host.evaluate('qaEmits.filter(n=>n==="duel:submit-guess").length')==1
        qa.viewport(host)
        if host.evaluate('multiplayerLiveState.room.status==="finished"'):
            host.evaluate('hideMultiplayerWinOverlay();restartMultiplayerRound("same")')
            qa.ready(host,'multiplayerLiveState.room.status==="live"')
        host.locator('#multiplayer-forfeit summary').click()
        assert host.locator('#multiplayer-forfeit-confirm').is_visible()
        assert host.evaluate('multiplayerLiveState.room.status')=='live'
        host.locator('#multiplayer-forfeit-confirm').click()
        qa.ready(guest,'multiplayerLiveState.room.status==="finished"')
        assert host.evaluate('qaEmits.filter(n=>n==="duel:forfeit").length')==1
        for page in [host,guest]:page.evaluate('hideMultiplayerWinOverlay();leaveMultiplayerRoom()')
        stage='challenge'
        host.evaluate('openDefiAmiFromAllModes()')
        fit_check(host,'challenge-input','challenge-ac',None,width)
        name=host.locator('#challenge-ac .ac-name').first.inner_text()
        qa.target(host,'#challenge-ac .ac-item:first-child',tap=True)
        if width<=640:
            assert host.evaluate('document.activeElement.id')!='challenge-input'
        qa.viewport(host);settle(host)
        assert host.locator('#challenge-name').inner_text()==name
        assert host.locator('#challenge-copied').is_hidden(),'selection must not copy/send a link'
        qa.target(host,'#challenge-preview button')
        host.screenshot(path=str(OUT/f'{engine}-{width}-challenge.png'))
        return {'engine':engine,'width':width,'ok':True}
    except Exception:
        host.screenshot(path=str(OUT/f'{engine}-{width}-{stage}-failure.png'))
        print('FAILED',engine,width,stage,host.evaluate('({room:multiplayerLiveState?.room,emits:window.qaEmits,error:document.getElementById("multiplayer-error")?.textContent})'),flush=True)
        raise
    finally:
        for c in contexts:c.close()


def main():
    OUT.mkdir(parents=True,exist_ok=True);qa.OUT=OUT
    results=[]
    try:
        with sync_playwright() as pw:
            for engine in os.getenv('QA_BROWSERS','chromium,webkit').split(','):
                browser=getattr(pw,engine).launch()
                try:
                    for width,height in [(360,740),(390,844),(1366,768)]:
                        with qa.local_server(f'{engine}-{width}'):
                            results.append(scenario(browser,engine,width,height))
                finally:browser.close()
    finally:(OUT/'report.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(results))

if __name__=='__main__':main()
