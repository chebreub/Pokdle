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
   for width,height in [(390,844),(1366,900)]:
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
     expect(state['visible']==[expected],f'Unexpected visible screens: {state}');expect(state['overflow']<=2,f'Horizontal overflow: {state}');return state
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
    def waveform():
     bars=page.locator('.mode-preview-audio .mode-preview-bars i');expect(bars.count()>0,'No waveform');heights=bars.evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().height)');expect(all(h>0 for h in heights),f'Collapsed bars: {heights}');return heights
    check('waveform',waveform,False)
    def start(action,target):
     nav('game','screen-all-modes');page.locator('button[data-action="openFromAllModes"][data-args=\'["'+action+'"]\']:visible').first.click();page.evaluate('typeof closeOverlayModal === "function" && closeOverlayModal()');return screen(target)
    def guess():
     start('startNormalGame','screen-game');page.locator('#guess-input').fill('Bulbizarre');page.locator('#btn-submit').click();expect(page.locator('#results-body tr').count()>0,'Guess missing');return screen('screen-game')
    check('normal-guess',guess)
    def finish():
     if page.locator('#btn-surrender').is_visible(): page.locator('#btn-surrender').click()
     page.locator('#win-box').wait_for(state='visible');return screen('screen-game')
    check('normal-result',finish);check('pokedex',lambda:nav('pokedex','screen-pokedex'))
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
    def ranking_error():
     nav('home','screen-config');page.route('**/api/leaderboard?*',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':False,'top':[],'me':None,'total':0})));page.evaluate('openLeaderboardV2("daily","today")');page.wait_for_timeout(800);text=page.locator('#overlay-body').inner_text();expect('indisponible' in text.lower(),'Failure rendered as an empty ranking: '+text[:180]);page.evaluate('closeOverlayModal()');page.unroute('**/api/leaderboard?*')
    check('ranking-error',ranking_error)
    def late():
     page.unroute('**/api/leaderboard?*');page.route('**/api/leaderboard?*',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'top':[],'me':None,'total':0})));page.evaluate('openLeaderboardV2("daily","today"); closeOverlayModal();');page.wait_for_timeout(700);expect(not page.locator('#overlay-modal').is_visible(),'Late response reopened closed dialog');page.unroute('**/api/leaderboard?*')
    check('ranking-closed',late);check('javascript-errors',lambda:expect(not errors,repr(errors)),False);ctx.close()
   browser.close()
 finally:
  server.terminate()
  try: server.wait(timeout=5)
  except subprocess.TimeoutExpired: server.kill()
  log.close();summary={'commit':os.environ.get('GITHUB_SHA','local'),'record_only':a.record_only,'passed':sum(c['ok'] for c in cases),'failed':sum(not c['ok'] for c in cases),'cases':cases};(out/'report.json').write_text(json.dumps(summary,indent=2),encoding='utf-8');print('QA_SUMMARY '+json.dumps({k:v for k,v in summary.items() if k!='cases'}),flush=True)
 if not a.record_only and summary['failed']: raise SystemExit(1)
if __name__=='__main__': main()
