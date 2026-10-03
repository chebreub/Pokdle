"""Browser QA on synthetic guest data, never production credentials."""
import argparse,json,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',default='quality-artifacts/current');p.add_argument('--record-only',action='store_true');a=p.parse_args()
 out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True);cases=[]
 log=(out/'server.log').open('w');env=dict(os.environ,PORT='3187',DATABASE_URL='',DISCORD_CLIENT_ID='',DISCORD_CLIENT_SECRET='')
 server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',env=env,stdout=log,stderr=subprocess.STDOUT);url='http://127.0.0.1:3187/'
 try:
  for _ in range(80):
   try: urllib.request.urlopen(url,timeout=2).close();break
   except Exception:
    if server.poll() is not None: raise RuntimeError('QA server exited; see server.log')
    time.sleep(.25)
  else: raise RuntimeError('QA server did not start')
  with sync_playwright() as pw:
   browser=pw.chromium.launch()
   for width,height in [(360,800),(390,844),(768,1024),(1366,900),(1920,1080),(2560,1440)]:
    ctx=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce');page=ctx.new_page();page.set_default_timeout(12000);errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def expect(value,message):
     if not value: raise AssertionError(message)
    def check(name,action,capture=True):
     item={'viewport':width,'case':name,'ok':False}
     try:
      result=action();item['ok']=True
      if result is not None: item['detail']=result
     except Exception as e: item['error']=str(e)[:1200]
     if capture:
      try: page.screenshot(path=str(out/f'{width}-{name}.png'),animations='disabled')
      except Exception as e: item['screenshot_error']=str(e)[:180]
     cases.append(item);print('QA '+json.dumps(item,ensure_ascii=True),flush=True)
    def screen(expected):
     page.locator('#'+expected).wait_for(state='visible')
     state=page.evaluate('''() => ({visible:[...document.querySelectorAll('main > [id^="screen-"]')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id),overflow:document.documentElement.scrollWidth-innerWidth})''')
     expect(state['visible']==[expected],f'Unexpected visible screens: {state}')
     if state['overflow']>2: state['offenders']=page.evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().width && e.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(e=>({tag:e.tagName,id:e.id,cls:String(e.className),right:e.getBoundingClientRect().right}))")
     expect(state['overflow']<=2,f'Horizontal overflow: {state}');return state
    def nav(tab,expected):
     ids={'home':'#nav-config','game':'#nav-game','pokedex':'#nav-collection','profile':'#nav-profile','social':'#nav-social'}
     page.locator(f'#mobile-tabbar [data-tab="{tab}"]' if width<=640 else ids[tab]).click();return screen(expected)
    def boot():
     page.goto(url,wait_until='domcontentloaded',timeout=45000)
     page.wait_for_function('typeof showScreen === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length > 1000',timeout=45000)
     page.wait_for_function('!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"',timeout=20000)
     page.evaluate('typeof closeOverlayModal === "function" && closeOverlayModal()');return screen('screen-config')
    check('home',boot);check('catalog',lambda:nav('game','screen-all-modes'))
    def pc0_desktop_foundations():
     if width<1101: return {'skipped':'desktop-only'}
     page.evaluate("goToConfig()");screen('screen-config')
     shell=page.locator('main').evaluate('(e)=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,padLeft:parseFloat(getComputedStyle(e).paddingLeft),padRight:parseFloat(getComputedStyle(e).paddingRight)}}')
     header=page.locator('.header-inner').evaluate('(e)=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}}')
     expect(abs(shell['left']-(width-shell['right']))<3,'Desktop main shell is not centered: '+repr(shell))
     expect(abs(header['left']-shell['left'])<3 and abs(header['right']-shell['right'])<3,'Header and main desktop shells are not aligned: '+repr([header,shell]))
     if width>=1920: expect(shell['width']>=1550,'Desktop shell still too narrow at 1920+: '+repr(shell))
     if width>=2200: expect(1700<=shell['width']<=1780,'Ultra-wide shell escaped its deliberate content cap: '+repr(shell))
     nav('game','screen-all-modes')
     grid=page.locator('#screen-all-modes .all-modes-grid').first
     cols=grid.evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
     expect(cols==3,'Desktop catalog should keep three generous columns: '+str(cols))
     cards=grid.locator('.all-modes-card:visible')
     if cards.count():
      widths=cards.evaluate_all('(els)=>els.slice(0,4).map(e=>e.getBoundingClientRect().width)')
      expect(min(widths)>=250,'Desktop catalog cards are still undersized: '+repr(widths))
     return screen('screen-all-modes')
    check('pc0-desktop-foundations',pc0_desktop_foundations)
    def search():
     page.locator('#mode-search').fill('cri');page.wait_for_timeout(150);cards=page.locator('#screen-all-modes .all-modes-card:visible');expect(cards.count()>0,'No search result');expect(any(t.strip()=='Cri' for t in page.locator('#screen-all-modes .all-modes-card:visible > b').all_text_contents()),'Cri missing');page.locator('#mode-search').fill('');return screen('screen-all-modes')
    check('search',search)
    def empty_search():
     page.locator('#mode-search').fill('zzzznoresultzzzz');page.wait_for_timeout(100)
     expect(page.locator('#mode-empty').is_visible(),'Missing empty state')
     expect(page.locator('#screen-all-modes .all-modes-card:visible').count()==0,'Filtered cards remain visible')
     page.locator('#mode-empty button').click();expect(page.locator('#mode-search').input_value()=='','Search was not reset')
     return screen('screen-all-modes')
    check('empty-search-reset',empty_search)
    def waveform():
     bars=page.locator('.mode-preview-audio .mode-preview-bars i');expect(bars.count()>0,'No waveform');heights=bars.evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().height)');expect(all(h>0 for h in heights),f'Collapsed bars: {heights}');return heights
    check('waveform',waveform,False)
    def preview_layout():
     sample=page.locator('.mode-preview-evolution img')
     sizes=sample.evaluate_all('(els)=>els.map(e=>({position:getComputedStyle(e).position,width:e.getBoundingClientRect().width}))')
     expect(len(sizes)==3,'Evolution sequence missing')
     expect(all(e['position']=='static' and 12<=e['width']<=30 for e in sizes),str(sizes))
     return sizes
    check('preview-layout',preview_layout,False)
    def icon_strokes():
     styles=page.locator('.club-pick-icon svg:visible').evaluate_all('(els)=>els.map(e=>({fill:getComputedStyle(e).fill,stroke:getComputedStyle(e).stroke}))')
     expect(len(styles)==3 and all(e['fill']=='none' and e['stroke']!='none' for e in styles),str(styles))
     return styles
    check('catalog-icons',icon_strokes,False)
    def start(action,target):
     nav('game','screen-all-modes');page.locator('button[data-action="openFromAllModes"][data-args=\'["'+action+'"]\']:visible').first.click();page.evaluate('typeof closeOverlayModal === "function" && closeOverlayModal()');return screen(target)
    def standard_guess_shell():
     expect(page.locator('#silhouette-box').is_hidden(),'Zoom clue shell leaked into standard gameplay')
     expect(page.locator('#pixel-box').is_hidden(),'Pixel clue shell leaked into standard gameplay')
     style=page.locator('#btn-submit').evaluate('(e)=>({image:getComputedStyle(e).backgroundImage,color:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopColor})')
     rendered=' '.join(style.values())
     blue_tokens=('57, 118, 236','57,118,236','47, 118, 255','47,118,255','40, 100, 219','40,100,219','36, 88, 201','36,88,201')
     expect(any(token in rendered for token in blue_tokens),'Primary guess CTA is not using the D0 blue treatment: '+repr(style))
    def guess():
     start('startNormalGame','screen-game');standard_guess_shell();page.locator('#guess-input').fill('Bulbizarre');page.locator('#btn-submit').click();expect(page.locator('#results-body tr').count()>0,'Guess missing');return screen('screen-game')
    check('normal-guess',guess)
    def pc1_classic_board():
     if width<1280:
      expect(page.locator('#classic-banner').is_hidden(),'PC1 desktop banner leaked below the desktop breakpoint')
      return {'skipped':'desktop-only'}
     expect(page.locator('#screen-game').get_attribute('data-game-mode')=='normal','Classic screen mode marker is missing')
     expect(page.locator('#classic-banner').is_visible(),'Classic mystery identity banner is missing on desktop')
     shell=page.locator('#screen-game .classic-game-shell')
     style=shell.evaluate('(e)=>({display:getComputedStyle(e).display,cols:getComputedStyle(e).gridTemplateColumns})')
     expect(style['display']=='grid','Classic desktop shell is not a grid: '+repr(style))
     expect(len([x for x in style['cols'].split(' ') if x])==2,'Classic desktop shell does not expose two columns: '+repr(style))
     command=page.locator('#screen-game .classic-game-command').bounding_box()
     results=page.locator('#screen-game #results-wrap').bounding_box()
     expect(command and results,'Classic desktop board regions are missing')
     expect(results['x']>command['x']+command['width'],'Results are not placed to the right of the command panel: '+repr([command,results]))
     expect(results['width']>command['width'],'Desktop clue board should be wider than the command rail: '+repr([command,results]))
     screen_width=page.locator('#screen-game').bounding_box()['width']
     expect(screen_width>(1500 if width>=1900 else 1240),'Classic game is still trapped in the old narrow desktop width: '+str(screen_width))
     return screen('screen-game')
    check('pc1-classic-board',pc1_classic_board)
    def finish():
     if page.locator('#btn-surrender').is_visible(): page.locator('#btn-surrender').click()
     page.locator('#win-box').wait_for(state='visible');page.wait_for_timeout(350)
     expect(page.locator('#btn-result-catalog').is_visible(),'Result has no route back to the catalog')
     expect(page.locator('#btn-restart').inner_text().strip()=='Rejouer','Normal replay action is unclear')
     expect(page.locator('#win-ceremony-progress').count()==0,'Loss should not show unchanged collection progress')
     return screen('screen-game')
    check('normal-result',finish)
    def daily_finish():
     start('startDailyGame','screen-game');standard_guess_shell()
     name=page.evaluate('secretPokemon.name');page.locator('#guess-input').fill(name);page.locator('#btn-submit').click()
     page.locator('#win-box').wait_for(state='visible');page.wait_for_timeout(400)
     expect('Continuer en illimité' in page.locator('#btn-restart').inner_text(),'Daily result does not explain the next game')
     expect(page.locator('#btn-result-catalog').is_visible(),'Daily result has no catalog exit')
     if width>=1280:
      expect(page.locator('#screen-game').get_attribute('data-game-mode')=='daily','Daily screen mode marker is missing')
      expect(page.locator('#daily-banner').is_visible() and page.locator('#classic-banner').is_hidden(),'Daily and classic identities overlap on desktop')
      shell_style=page.locator('#screen-game .classic-game-shell').evaluate('(e)=>getComputedStyle(e).display')
      expect(shell_style=='grid','Daily did not inherit the classic desktop board')
     progress=page.locator('#win-ceremony-progress')
     expect(progress.count()==1 and progress.evaluate('(e)=>e.tagName')=='DETAILS','Collection progress is not a collapsible detail')
     return screen('screen-game')
    check('daily-result',daily_finish)
    def completed_home():
     nav('home','screen-config')
     expect(page.locator('#daily-hero').get_attribute('data-daily-state')=='complete','Daily summary did not update')
     page.wait_for_timeout(3500)
     return screen('screen-config')
    check('home-completed',completed_home)
    check('pokedex',lambda:nav('pokedex','screen-pokedex'))
    def detail():
     page.locator('#pokedex-grid .pokedex-card').first.click();page.locator('#pokedex-detail').wait_for(state='visible')
     if width<=640: page.locator('#pokedex-detail .pokedex-back-to-list').first.click();page.locator('#pokedex-grid').wait_for(state='visible')
     return screen('screen-pokedex')
    check('encyclopedia-back',detail)
    def locked():
     nav('pokedex','screen-pokedex');page.locator('[data-pokedex-view="collection"]').click();page.locator('#pokedex-grid .state-unknown').first.click()
     if width<=640: page.locator('#pokedex-detail .pokedex-back-to-list').first.click();page.locator('#pokedex-grid').wait_for(state='visible')
     return screen('screen-pokedex')
    check('collection-back',locked);check('profile',lambda:nav('profile','screen-profile'))
    def d3_profile_density():
     nav('profile','screen-profile')
     page.evaluate("""() => {
       playerProfile.speedrunHighScore=14;
       playerProfile.quizHighScore=18;
       playerProfile.higherLowerHighScore=9;
       playerProfile.draftScoreAttackRecords={1:512,2:488,9:530};
       renderProfileScreen();
     }""")
     disclosures=page.locator('#screen-profile [data-profile-mobile-collapse]')
     expect(disclosures.count()>=4,'Profile disclosures missing')
     if width<=640:
      expect(all(not x for x in disclosures.evaluate_all('(els)=>els.map(e=>e.open)')),'Mobile profile disclosures should start collapsed')
      cards=page.locator('#screen-profile .profile-stat-grid .profile-stat-card')
      rects=cards.evaluate_all('(els)=>els.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))')
      expect(len(rects)==4 and abs(rects[0]['y']-rects[1]['y'])<3 and rects[2]['y']>rects[0]['y'],'Mobile profile stats are not compact 2x2: '+repr(rects))
     else:
      expect(all(disclosures.evaluate_all('(els)=>els.map(e=>e.open)')),'Desktop profile disclosures should start open')
     records_details=page.locator('#screen-profile .profile-records-panel.profile-disclosure').first
     records_details.evaluate('(e)=>e.open=true')
     expect(page.locator('#profile-mode-records .profile-record-card').count()==3,'Unexpected compact record-card count')
     expect('Score Attack Gen' not in page.locator('#profile-mode-records').inner_text(),'Score Attack generations still render as separate cards')
     expect(page.locator('#profile-score-attack-record .profile-score-attack-card').count()==1,'Score Attack single-record card missing')
     page.locator('#profile-score-attack-gen').select_option('9')
     expect('530' in page.locator('#profile-score-attack-record').inner_text(),'Score Attack generation selector did not update the visible record')
     return screen('screen-profile')
    check('d3-profile-density',d3_profile_density)
    def ranking_tool():
     page.evaluate('openRankingMode()');screen('screen-ranking')
     if width<=640:
      expect(page.locator('#ranking-grid .ranking-mobile-flow').is_visible(),'Mobile ranking flow missing')
      expect(page.locator('#ranking-grid .ranking-table').count()==0,'Desktop ranking table leaked into mobile')
      page.locator('.ranking-mobile-slot').click()
      page.locator('#rank-float-picker').wait_for(state='visible')
      expect(page.locator('#rank-float-list .rank-float-item').count()>0,'Mobile ranking picker has no candidates')
      page.locator('#rank-float-list .rank-float-item').first.click()
      expect('is-filled' in (page.locator('.ranking-mobile-slot').get_attribute('class') or ''),'Mobile ranking choice was not persisted')
     else:
      expect(page.locator('#ranking-grid .ranking-table').is_visible(),'Desktop ranking table missing')
     return screen('screen-ranking')
    check('ranking-responsive',ranking_tool)
    def games_ranking_tool():
     page.evaluate('openGamesRankingMode()');screen('screen-games-ranking')
     if width<=640:
      cards=page.locator('.games-ranking-mobile-card')
      expect(cards.count()==10,f'Unexpected mobile game-card count: {cards.count()}')
      expect(page.locator('.games-ranking-table').count()==0,'Desktop games table leaked into mobile')
      field=cards.first.locator('input').first
      field.fill('8');field.press('Tab')
      expect(cards.first.locator('.games-ranking-mobile-global b').inner_text().strip()!='5.0','Mobile game average did not update')
     else:
      expect(page.locator('.games-ranking-table').is_visible(),'Desktop games table missing')
     return screen('screen-games-ranking')
    check('games-ranking-responsive',games_ranking_tool)
    check('draft',lambda:start('openDraftScoreAttackMode','screen-draft-score-attack'))
    def party():
     nav('social','screen-all-modes');page.locator('button[data-action="openFromAllModes"][data-args=\'["openPartyRoomMode"]\']:visible').first.click();return screen('screen-party-room')
    check('party-entry',party)
    def d4_party_polish():
     page.evaluate("""() => {
       partyRoomState.room={
         code:'QA123',status:'waiting',gameMode:'guess',roundNumber:0,totalRounds:5,minPlayers:2,maxPlayers:8,
         selectedGens:[1,2,3,4,5,6,7,8,9],
         players:[
           {id:'qa-host',nickname:'QA Host',score:0,isSelf:true,isHost:true,connected:true},
           {id:'qa-guest',nickname:'QA Guest',score:0,isSelf:false,isHost:false,connected:true}
         ]
       };
       renderPartyRoom();
     }""")
     joined=page.locator('#party-joined')
     expect(joined.get_attribute('data-party-phase')=='setup','Party setup phase marker missing')
     expect(page.locator('#party-action-phase').inner_text().strip()=='PRÊT','Party action dock phase is not ready')
     expect('5 manches' in page.locator('#party-options-summary').inner_text(),'Compact Party rules summary missing')
     disclosure=page.locator('#party-options-disclosure')
     if width<=800:
      expect(not disclosure.evaluate('(e)=>e.open'),'Party rules should start collapsed on tablet/mobile')
      action_position=page.locator('#party-action-dock').evaluate('(e)=>getComputedStyle(e).position')
      expect(action_position==('fixed' if width<=560 else 'sticky'),'Party primary action dock has the wrong mobile/tablet positioning: '+action_position)
     else:
      expect(disclosure.evaluate('(e)=>e.open'),'Party rules should stay open on desktop')
      expect(page.locator('#party-action-dock').evaluate('(e)=>getComputedStyle(e).position')!='sticky','Party action dock should not be sticky on desktop')
     if width<=560:
      tiles=page.locator('#party-mode-select .party-mode-tile')
      rects=tiles.evaluate_all('(els)=>els.slice(0,4).map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,h:e.getBoundingClientRect().height}))')
      expect(len(rects)==4 and abs(rects[0]['y']-rects[1]['y'])<3 and abs(rects[0]['y']-rects[2]['y'])<3 and rects[3]['y']>rects[0]['y'],'Party game picker is not compact 3-column mobile grid: '+repr(rects))
      expect(max(r['h'] for r in rects)<110,'Party mobile game tiles are still too tall: '+repr(rects))
     page.evaluate('() => { partyRoomState.room=null; renderPartyRoom(); }')
     return screen('screen-party-room')
    check('d4-party-polish',d4_party_polish)
    check('pixel',lambda:start('startPixelGame','screen-game'))
    def d2_pixel_shell():
     start('startPixelGame','screen-game');box=page.locator('#pixel-box');expect(box.is_visible(),'Pixel shell missing');expect(page.locator('#pixel-box .visual-clue-canvas').is_visible(),'Pixel visual canvas missing');expect(page.locator('#pixel-level').inner_text().startswith('Netteté '),'Pixel progress label missing');return screen('screen-game')
    check('d2-pixel-shell',d2_pixel_shell)
    def d2_zoom_shell():
     start('startSilhouetteGame','screen-game');box=page.locator('#silhouette-box');expect(box.is_visible(),'Zoom shell missing');expect(page.locator('#silhouette-box .visual-clue-canvas').is_visible(),'Zoom visual canvas missing');expect(page.locator('#silhouette-level').inner_text().startswith('Détail '),'Zoom progress label missing');return screen('screen-game')
    check('d2-zoom-shell',d2_zoom_shell)
    check('cry',lambda:start('startCryGame','screen-game'))
    def d2_cry_shell():
     start('startCryGame','screen-game');expect(page.locator('#cry-box .cry-player-card').is_visible(),'Cry player card missing');expect(page.locator('#cry-box .cry-waveform i').count()>=8,'Cry waveform is incomplete');btn=page.locator('#cry-play-btn');expect('btn-blue' in (btn.get_attribute('class') or ''),'Cry play CTA is not primary blue');return screen('screen-game')
    check('d2-cry-shell',d2_cry_shell)
    def d2_connections_shell():
     page.evaluate('openPokeConnectionsMode()');screen('screen-poke-connections');expect(page.locator('.poke-connections-grid .poke-connections-tile').count()==16,'Connections board does not contain 16 tiles');page.locator('.poke-connections-tile').first.click();expect(page.locator('.poke-connections-tile.is-selected').count()==1,'Connections selected state missing');expect(page.locator('.poke-connections-actions .btn-blue').count()==1,'Connections primary action missing');return screen('screen-poke-connections')
    check('d2-connections-shell',d2_connections_shell)
    def d2_speedrun_shell():
     page.evaluate('openSpeedrunMode()');screen('screen-speedrun');start_btn=page.locator('.speedrun-start-btn');expect('btn-blue' in (start_btn.get_attribute('class') or ''),'Speedrun start CTA is not primary blue');start_btn.click();expect(page.locator('.speedrun-pokemon').is_visible(),'Speedrun sprite stage missing');expect(page.locator('#speedrun-timer').is_visible(),'Speedrun timer missing');return screen('screen-speedrun')
    check('d2-speedrun-shell',d2_speedrun_shell)
    def d2_type_combo_shell():
     page.evaluate('openTypeComboSolo()');screen('screen-type-combo');start_btn=page.locator('.tc-start-btn');expect('btn-blue' in (start_btn.get_attribute('class') or ''),'Type Combo start CTA is not primary blue');start_btn.click();expect(page.locator('.tc-combo').is_visible(),'Type Combo prompt stage missing');expect(page.locator('#type-combo-timer').is_visible(),'Type Combo timer missing');return screen('screen-type-combo')
    check('d2-type-combo-shell',d2_type_combo_shell)
    check('quiz',lambda:start('startQuizGame','screen-game'))
    def draft_pro():
     nav('game','screen-all-modes')
     page.locator('button[data-action="openFromAllModes"][data-args=\'["openDraftScoreAttackMode", true]\']:visible').first.click()
     return screen('screen-draft-score-attack')
    check('draft-pro',draft_pro)
    def gameplay_family_smoke():
     matrix=[
      ('startSilhouetteGame','screen-game'),('startDescriptionMode','screen-game'),('startMysteryStatGame','screen-game'),
      ('startWeightBattle','screen-game'),('startEvolutionChainGame','screen-game'),('startPokedexOrderGame','screen-game'),
      ('openOddOneOutMode','screen-odd-one-out'),('openHigherLowerMode','screen-higher-lower'),
      ('openPokeConnectionsMode','screen-poke-connections'),('openSpeedrunMode','screen-speedrun'),
      ('openTypeComboSolo','screen-type-combo'),('openDraftArenaMode','screen-draft-arena')
     ]
     opened=[]
     for action,target in matrix:
      page.evaluate('(name)=>window[name]()',action);page.evaluate('typeof closeOverlayModal === "function" && closeOverlayModal()')
      screen(target)
      if target!='screen-game':
       expect(page.locator('#'+target+' .gameplay-screen-card').count()==1,'Dedicated game is missing the common shell: '+action)
      opened.append(action)
     return opened
    if width in (390,1366): check('gameplay-family-smoke',gameplay_family_smoke,False)
    def back_history():
     nav('game','screen-all-modes');page.locator('#mode-search').fill('cri');nav('pokedex','screen-pokedex')
     page.go_back();screen('screen-all-modes');expect(page.locator('#mode-search').input_value()=='cri','Back lost catalog search')
    check('browser-back',back_history)
    def ranking_error():
     nav('home','screen-config');page.route('**/api/leaderboard?*',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':False,'top':[],'me':None,'total':0})));page.evaluate('openLeaderboardV2("daily","today")');page.wait_for_timeout(800);text=page.locator('#overlay-body').inner_text();expect('indisponible' in text.lower(),'Failure rendered as an empty ranking: '+text[:180]);page.evaluate('closeOverlayModal()');page.unroute('**/api/leaderboard?*')
    check('ranking-error',ranking_error)
    def late():
     page.unroute('**/api/leaderboard?*');pending=[]
     page.route('**/api/leaderboard?*',lambda r:pending.append(r))
     page.evaluate('void openLeaderboardV2("daily","today")');page.wait_for_timeout(200)
     expect(bool(pending),'No request was started')
     page.evaluate('closeOverlayModal()')
     for route in pending:route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'top':[],'me':None,'total':0}))
     page.wait_for_timeout(150);expect(not page.locator('#overlay-modal').is_visible(),'Late response reopened closed dialog')
     page.unroute('**/api/leaderboard?*')
    check('ranking-closed',late)
    def dark():
     nav('home','screen-config');page.evaluate("document.body.classList.add('theme-dark')");return screen('screen-config')
    check('home-dark',dark)
    def header_density():
     rect=page.locator('body > header').bounding_box()
     if width>640: expect(rect is not None and rect['height']<=180,f'Header takes too much space: {rect}')
     return rect
    check('header-density',header_density,False)
    page.evaluate("document.body.classList.remove('theme-dark')")
    check('javascript-errors',lambda:expect(not errors,repr(errors)),False);ctx.close()
   browser.close()
 finally:
  server.terminate()
  try: server.wait(timeout=5)
  except subprocess.TimeoutExpired: server.kill()
  log.close();summary={'commit':os.environ.get('GITHUB_SHA','local'),'record_only':a.record_only,'passed':sum(c['ok'] for c in cases),'failed':sum(not c['ok'] for c in cases),'cases':cases};(out/'report.json').write_text(json.dumps(summary,indent=2),encoding='utf-8');print('QA_SUMMARY '+json.dumps({k:v for k,v in summary.items() if k!='cases'}),flush=True)
 if not a.record_only and summary['failed']: raise SystemExit(1)
if __name__=='__main__': main()
