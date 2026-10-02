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
   for width,height in [(360,800),(390,844),(768,1024),(1366,900),(1920,1080)]:
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
    def guess():
     start('startNormalGame','screen-game');page.locator('#guess-input').fill('Bulbizarre');page.locator('#btn-submit').click();expect(page.locator('#results-body tr').count()>0,'Guess missing');return screen('screen-game')
    check('normal-guess',guess)
    def finish():
     if page.locator('#btn-surrender').is_visible(): page.locator('#btn-surrender').click()
     page.locator('#win-box').wait_for(state='visible');return screen('screen-game')
    check('normal-result',finish)
    def daily_finish():
     start('startDailyGame','screen-game')
     name=page.evaluate('secretPokemon.name');page.locator('#guess-input').fill(name);page.locator('#btn-submit').click()
     page.locator('#win-box').wait_for(state='visible');return screen('screen-game')
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
    check('collection-back',locked);check('profile',lambda:nav('profile','screen-profile'));check('draft',lambda:start('openDraftScoreAttackMode','screen-draft-score-attack'))
    def party():
     nav('social','screen-all-modes');page.locator('button[data-action="openFromAllModes"][data-args=\'["openPartyRoomMode"]\']:visible').first.click();return screen('screen-party-room')
    check('party-entry',party)
    check('pixel',lambda:start('startPixelGame','screen-game'))
    check('cry',lambda:start('startCryGame','screen-game'))
    check('quiz',lambda:start('startQuizGame','screen-game'))
    def draft_pro():
     nav('game','screen-all-modes')
     page.locator('button[data-action="openFromAllModes"][data-args=\'["openDraftScoreAttackMode", true]\']:visible').first.click()
     return screen('screen-draft-score-attack')
    check('draft-pro',draft_pro)
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
