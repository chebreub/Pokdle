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
      try: page.screenshot(path=str(out/f'{width}-{name}.jpg'),quality=90,animations='disabled')
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
    check('home',boot)
    def audit_home_readability():
     colors=page.locator('#daily-hero-streak').evaluate('(e)=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor})')
     import re
     def luminance(value):
      rgb=[int(v)/255 for v in re.findall(r'\d+',value)[:3]]
      linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
      return sum(a*b for a,b in zip(linear,[.2126,.7152,.0722]))
     a,b=luminance(colors['fg']),luminance(colors['bg']);contrast=(max(a,b)+.05)/(min(a,b)+.05)
     expect(contrast>=4.5,'Streak contrast is too low: '+repr(colors))
     return {'contrast':round(contrast,2)}
    check('audit-home-readability',audit_home_readability,False)
    def cosy_home():
     expect(page.locator('#daily-hero').count()==1,'Daily hero is duplicated')
     expect(page.locator('#home-games-grid .home-game').count()==6,'Home discovery shortcuts are missing')
     expect(page.locator('#daily-notebook .notebook-cell').count()==27,'Notebook must retain all nine criteria')
     hero=page.locator('#daily-hero').bounding_box();catalog=page.locator('.home-discovery').bounding_box();party=page.locator('.home-pathways').bounding_box()
     expect(hero and catalog and party and catalog['y']>=hero['y']+hero['height'] and party['y']>=catalog['y']+catalog['height'],'Daily, catalog and social sections are out of order')
     return screen('screen-config')
    check('cosy-home',cosy_home)
    check('catalog',lambda:nav('game','screen-all-modes'))
    def audit_catalog():
     for category in ['game','social']:
      nav(category,'screen-all-modes')
      sections=page.locator('#screen-all-modes .all-modes-cat:visible')
      for section in sections.all(): expect(section.locator('.all-modes-card:visible').count()>0,'Empty category still rendered')
     nav('game','screen-all-modes')
     if width<=760:
      expect(page.locator('#mode-difficulty').is_hidden(),'Mobile filters should start collapsed')
      page.locator('#mode-refinements-toggle').click()
      expect(page.locator('#mode-difficulty').is_visible(),'Mobile filter button did not expose difficulty')
      page.locator('#mode-difficulty').select_option('easy')
      expect(page.locator('#screen-all-modes .all-modes-card:visible').count()>0,'Difficulty filter removed all easy games')
      page.locator('#mode-difficulty').select_option('all')
      page.locator('#mode-refinements-toggle').click()
     return screen('screen-all-modes')
    check('audit-catalog',audit_catalog)
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
     expect(page.locator('#screen-all-modes .all-modes-cat:visible').count()==0,'Empty search still renders category headings')
     page.locator('#mode-empty button').click();expect(page.locator('#mode-search').input_value()=='','Search was not reset')
     return screen('screen-all-modes')
    check('empty-search-reset',empty_search)
    def waveform():
     bars=page.locator('#screen-all-modes .mode-preview-audio .mode-preview-bars i');expect(bars.count()>0,'No waveform');heights=bars.evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().height)');expect(all(h>0 for h in heights),f'Collapsed bars: {heights}');return heights
    check('waveform',waveform,False)
    def preview_layout():
     sample=page.locator('.mode-preview-evolution img')
     sizes=sample.evaluate_all('(els)=>els.map(e=>({position:getComputedStyle(e).position,width:e.getBoundingClientRect().width}))')
     expect(len(sizes)==3,'Evolution sequence missing')
     expect(all(e['position']=='static' and 12<=e['width']<=30 for e in sizes),str(sizes))
     return sizes
    check('preview-layout',preview_layout,False)
    def icon_strokes():
     nav('social','screen-all-modes')
     styles=page.locator('.club-pick-icon svg:visible').evaluate_all('(els)=>els.map(e=>({fill:getComputedStyle(e).fill,stroke:getComputedStyle(e).stroke}))')
     expect(len(styles)==3 and all(e['fill']=='none' and e['stroke']!='none' for e in styles),str(styles))
     nav('game','screen-all-modes')
     return styles
    check('catalog-icons',icon_strokes,False)
    def illustrated_cards():
     picks=page.locator('#catalog-picks .has-mode-illustration')
     expect(picks.count()==3,'Expected three illustrated pilot cards')
     for card in picks.all():
      img=card.locator('.mode-illustration img')
      img.scroll_into_view_if_needed()
      img.evaluate('(e)=>e.decode()')
      expect(img.evaluate('(e)=>e.complete && e.naturalWidth>0'),'Illustration asset failed to load')
      picture=img.bounding_box();title=card.locator('b').bounding_box();box=card.bounding_box()
      expect(picture['width']>=100,'Illustration is still a tiny thumbnail')
      expect(title['x']>=box['x'] and title['x']+title['width']<=box['x']+box['width']+1,'Card title is clipped')
      if width<=760:
       expect(box['height']<=190,'Mobile illustrated card is too tall')
       expect(title['x']>=picture['x']+picture['width'],'Mobile text should sit beside the illustration')
      else:
       expect(title['y']>=picture['y']+picture['height'],'Desktop text overlaps its illustration')
       expect(abs(picture['width']-(box['width']-2))<3,'Desktop illustration should fill its card width')
     expect(page.locator('.all-modes-card[data-args=\'["startNormalGame"]\']').is_visible(),'Unlimited mode disappeared from the catalog')
     page.locator('#catalog-picks').scroll_into_view_if_needed()
     page.screenshot(path=str(out/f'{width}-illustrated-selection.jpg'),quality=90,animations='disabled')
     page.evaluate("document.body.classList.add('theme-dark')")
     page.screenshot(path=str(out/f'{width}-illustrated-selection-dark.jpg'),quality=90,animations='disabled')
     page.evaluate("document.body.classList.remove('theme-dark')")
     page.locator('#mode-search').fill('connections')
     result=page.locator('.all-modes-card.has-mode-illustration:visible')
     expect(result.count()==1,'Connections search did not preserve the illustrated result')
     result.locator('img').evaluate('(e)=>e.decode()')
     title=result.locator('b').bounding_box();picture=result.locator('img').bounding_box()
     expect(title['width']>=140,'Search title is still trapped in the old icon column: '+repr(title))
     expect(title['x']+title['width']<=picture['x'],'Search image overlaps the text column')
     expect(result.locator('small').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=13,'Search description is too small')
     expect(result.bounding_box()['height']<=220,'Search result is unnecessarily tall')
     page.screenshot(path=str(out/f'{width}-illustrated-search.jpg'),quality=90,animations='disabled')
     page.locator('#mode-search').fill('')
     return screen('screen-all-modes')
    check('illustrated-cards',illustrated_cards,False)
    def pc3_catalog_shelves():
     if width<1280: return {'skipped':'desktop-only'}
     nav('game','screen-all-modes')
     section=page.locator('#screen-all-modes .all-modes-cat:visible').first
     grid=section.locator('.all-modes-grid')
     title=section.locator('.all-modes-cat-title')
     layout=section.evaluate('(e)=>({display:getComputedStyle(e).display,cols:getComputedStyle(e).gridTemplateColumns})')
     expect(layout['display']=='grid','PC3 catalog family is not a desktop shelf: '+repr(layout))
     expect(len([x for x in layout['cols'].split(' ') if x])==2,'PC3 catalog shelf does not expose label + cards columns: '+repr(layout))
     tb=title.bounding_box();gb=grid.bounding_box()
     expect(tb and gb and gb['x']>tb['x']+tb['width'],'Catalog family label is not beside its card grid: '+repr([tb,gb]))
     cols=grid.evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
     expect(cols==3,'Desktop catalog shelf should retain three generous cards: '+str(cols))
     picks=page.locator('#catalog-picks .club-pick:visible')
     if picks.count()>=3:
      rects=picks.evaluate_all('(els)=>els.slice(0,3).map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,h:e.getBoundingClientRect().height}))')
      expect(abs(rects[0]['y']-rects[1]['y'])<3 and abs(rects[0]['y']-rects[2]['y'])<3,'Featured desktop picks are not a single row: '+repr(rects))
      expect(all(300<=r['h']<=520 for r in rects),'Illustrated desktop picks should fit a cover and readable copy: '+repr(rects))
     return screen('screen-all-modes')
    check('pc3-catalog-shelves',pc3_catalog_shelves)
    def start(action,target):
     nav('game','screen-all-modes');page.locator('button[data-action="openFromAllModes"][data-args=\'["'+action+'"]\']:visible').first.click();page.evaluate('typeof closeOverlayModal === "function" && closeOverlayModal()');return screen(target)
    def standard_guess_shell():
     expect(page.locator('#silhouette-box').is_hidden(),'Zoom clue shell leaked into standard gameplay')
     expect(page.locator('#pixel-box').is_hidden(),'Pixel clue shell leaked into standard gameplay')
     style=page.locator('#btn-submit').evaluate('(e)=>({image:getComputedStyle(e).backgroundImage,color:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopColor})')
     rendered=' '.join(style.values())
     blue_tokens=('64, 105, 224','64,105,224','57, 118, 236','57,118,236','47, 118, 255','47,118,255','40, 100, 219','40,100,219','36, 88, 201','36,88,201')
     expect(any(token in rendered for token in blue_tokens),'Primary guess CTA is not using the D0 blue treatment: '+repr(style))
    def autocomplete_overlay():
     start('startNormalGame','screen-game');standard_guess_shell()
     page.locator('#guess-input').fill('Bul')
     first=page.locator('#guess-ac:not(.hidden) .ac-item').first
     first.wait_for(state='visible')
     item_box=first.bounding_box();button_box=page.locator('#btn-submit').bounding_box();surrender_box=page.locator('#btn-surrender').bounding_box()
     expect(item_box and button_box and surrender_box,'Autocomplete or action geometry missing')
     def overlaps(a,b):
      return min(a['x']+a['width'],b['x']+b['width'])>max(a['x'],b['x']) and min(a['y']+a['height'],b['y']+b['height'])>max(a['y'],b['y'])
     expect(not overlaps(item_box,button_box),'First autocomplete suggestion overlaps Deviner: '+repr([item_box,button_box]))
     expect(not overlaps(item_box,surrender_box),'First autocomplete suggestion overlaps Abandonner: '+repr([item_box,surrender_box]))
     if width>=1280:
      input_box=page.locator('#guess-input').bounding_box()
      bar_box=page.locator('#screen-game .classic-game-command > .search-bar').bounding_box()
      list_box=page.locator('#guess-ac').bounding_box()
      expect(input_box['width']>=360,'Desktop input remains too narrow for Pokemon names: '+repr(input_box))
      expect(button_box['y']>=input_box['y']+input_box['height'],'Guess actions should sit below the full-width input: '+repr([input_box,button_box]))
      expect(bar_box and list_box,'Desktop autocomplete panel geometry missing')
      expect(list_box['y']>=bar_box['y']+bar_box['height']+4,'Autocomplete panel does not open below the whole command bar: '+repr([bar_box,list_box]))
      expect(list_box['width']>=bar_box['width']-24,'Autocomplete panel is still too narrow on desktop: '+repr([bar_box,list_box]))
      expect(abs(list_box['x']-(bar_box['x']+10))<4,'Autocomplete panel is not aligned with the command bar: '+repr([bar_box,list_box]))
     else:
      wrapper_z=page.locator('#screen-game .ac-wrapper').evaluate('(e)=>Number(getComputedStyle(e).zIndex)||0')
      submit_z=page.locator('#btn-submit').evaluate('(e)=>Number(getComputedStyle(e).zIndex)||0')
      expect(wrapper_z>submit_z,'Autocomplete stacking context is not above surrounding content: '+repr([wrapper_z,submit_z]))
     page.locator('#guess-input').press('Escape')
     expect(page.locator('#guess-ac').is_hidden(),'Autocomplete cleanup failed after overlay QA')
     return screen('screen-game')
    check('autocomplete-overlay',autocomplete_overlay)
    def guess():
     start('startNormalGame','screen-game');standard_guess_shell();page.locator('#guess-input').fill('Bulbizarre');page.locator('#btn-submit').click();expect(page.locator('#results-body tr').count()>0,'Guess missing');return screen('screen-game')
    check('normal-guess',guess)
    def cosy_clues():
     row=page.locator('#results-body tr').first
     expect(row.locator('td[data-label="Forme"]').count()==1,'Alternative form criterion was lost')
     expect(row.locator('td').count()==10,'One of the nine comparison criteria was lost')
     page.wait_for_function('Array.from(document.querySelectorAll("#results-body .comparison-type img")).every(img=>img.complete && img.naturalWidth>0)')
     expect(row.locator('.comparison-type img').count()==2,'Both Bulbasaur types should have a local icon')
     expect('Plante' in row.inner_text() and 'Poison' in row.inner_text(),'Type names must remain visible')
     sheen=row.locator('.guess-result-cell.c-ok,.guess-result-cell.c-close,.guess-result-cell.c-wrong').first.evaluate('(e)=>getComputedStyle(e,"::after").display')
     expect(sheen=='none','Reduced-motion mode leaves a white veil on clue cells')
     if width<=640:
      label=row.locator('td[data-label="Type 1"]').evaluate('(e)=>parseFloat(getComputedStyle(e,"::before").fontSize)')
      expect(label>=12,'Mobile clue labels are too small: '+str(label))
     return screen('screen-game')
    check('cosy-clues',cosy_clues)
    def pc1_classic_board():
     if width<1280:
      expect(page.locator('#classic-banner').is_hidden(),'PC1 desktop banner leaked below the desktop breakpoint')
      return {'skipped':'desktop-only'}
     expect(page.locator('#screen-game').get_attribute('data-game-mode')=='normal','Classic screen mode marker is missing')
     expect(page.locator('#classic-banner').is_visible(),'Classic mystery identity banner is missing on desktop')
     shell=page.locator('#screen-game .classic-game-shell')
     style=shell.evaluate('(e)=>({display:getComputedStyle(e).display,cols:getComputedStyle(e).gridTemplateColumns})')
     expect(style['display']=='grid','Classic desktop shell is not a grid: '+repr(style))
     expect(len([x for x in style['cols'].split(' ') if x])==(2 if width>=1680 else 1),'Classic desktop layout does not adapt to its available width: '+repr(style))
     command=page.locator('#screen-game .classic-game-command').bounding_box()
     results=page.locator('#screen-game #results-wrap').bounding_box()
     expect(command and results,'Classic desktop board regions are missing')
     if width>=1680:
      expect(results['x']>command['x']+command['width'],'Wide desktop results should stay beside the command panel: '+repr([command,results]))
      expect(results['width']>command['width'],'Wide desktop clue board should be wider than the command rail: '+repr([command,results]))
     else:
      expect(results['y']>=command['y']+command['height'],'Laptop clues should sit below the input: '+repr([command,results]))
      expect(results['width']>=1200,'Laptop clue board is not using its available width: '+repr(results))
     expect(page.locator('#results-table th').first.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=12,'Clue column headers are too small')
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
     if width>=1280:
      win=page.locator('#win-box').bounding_box();history=page.locator('#results-wrap').bounding_box()
      expect(win and history and win['width']>1000,'PC2 result dashboard is still narrow: '+repr(win))
      expect(abs(win['x']-history['x'])<3 and abs(win['width']-history['width'])<5,'Result dashboard and clue history do not share the desktop board width: '+repr([win,history]))
      expect(page.locator('.classic-game-command').evaluate('(e)=>getComputedStyle(e).display')=='none','Finished desktop game still reserves the command rail')
      cols=page.locator('#win-box').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
      expect(cols==2,'Normal desktop result is not a two-column dashboard: '+str(cols))
      preview=page.locator('#win-ranking-preview')
      expect(preview.count()==1 and preview.bounding_box()['x']>page.locator('#win-box .win-inner').bounding_box()['x'],'Ranking preview is not in the desktop stats rail')
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
     if width>=1280:
      win=page.locator('#win-box').bounding_box()
      expect(win and win['width']>1000,'Daily result dashboard is still narrow: '+repr(win))
      expect(progress.bounding_box()['x']>page.locator('#win-box .win-inner').bounding_box()['x'],'Pokédex progress is not in the desktop stats rail')
     return screen('screen-game')
    check('daily-result',daily_finish)
    def cosy_leaderboard():
     celebration=page.locator('#pokedex-registration-layer:not(.hidden) [data-action="closePokedexRegistration"]')
     if celebration.is_visible(): celebration.click()
     page.evaluate("""async () => {
       window.__qaLeaderboardFetch=leaderboardFetchJson;
       leaderboardFetchJson=async()=>({
         ok:true,label:'Pokémon du jour',unit:'essais',total:8,authenticated:true,
         me:{rank:4,username:'QA',score:4,me:true},
         top:[
           {rank:1,username:'Red',score:2},
           {rank:2,username:'Blue',score:3},
           {rank:3,username:'Leaf',score:3},
           {rank:4,username:'QA',score:4,me:true},
           {rank:5,username:'Gold',score:5},
           {rank:6,username:'Silver',score:6}
         ],
         around:[{rank:7,username:'Crystal',score:7}]
       });
       await openLeaderboardV2('daily','all');
     }""")
     page.locator('#overlay-body .lbv3-podium').wait_for(state='visible')
     expect(page.locator('#pokedex-registration-layer:not(.hidden)').count()==0,'Registration ceremony hides the ranking')
     overlay=page.locator('.overlay-card:has(.lbv3-shell)').bounding_box()
     expect(overlay and overlay['width']<=width and (width<1280 or overlay['width']>1100),'Leaderboard does not fit its viewport: '+repr(overlay))
     shell=page.locator('.lbv3-shell')
     cols=shell.evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
     expect(cols==1,'Leaderboard should present the podium before the full-width list: '+str(cols))
     podium=page.locator('.lbv3-podium').bounding_box();listing=page.locator('.lbv3-list').bounding_box()
     expect(podium and listing and listing['y']>=podium['y']+podium['height']-3,'Leaderboard list is not below the podium: '+repr([podium,listing]))
     expect(page.locator('.lbv3-personal').is_visible(),'Personal position missing')
     expect(page.locator('.lbv3-mode-tab[aria-pressed="true"]').count()==1,'Selected game is not announced')
     page.screenshot(path=str(out/f'{width}-cosy-leaderboard.jpg'),quality=90,animations='disabled')
     page.evaluate("""() => {
       if (window.__qaLeaderboardFetch) { leaderboardFetchJson=window.__qaLeaderboardFetch; delete window.__qaLeaderboardFetch; }
       if (typeof closeOverlayModal==='function') closeOverlayModal();
     }""")
     return screen('screen-game')
    check('cosy-leaderboard',cosy_leaderboard,False)
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
    check('collection-back',locked)
    def audit_collection():
     expect(page.locator('#pokedex-region-progress').is_hidden(),'Regional details should start folded')
     page.locator('.pokedex-progress-details summary').click()
     expect(page.locator('#pokedex-region-progress').is_visible(),'Regional detail disclosure did not open')
     page.locator('.pokedex-progress-details summary').click()
     page.locator('#pokedex-filters-toggle').click()
     expect(page.locator('#pokedex-gen-filter').is_visible(),'Collection filters are unreachable')
     page.locator('#pokedex-filters-toggle').click()
     expect(page.locator('#pokedex-gen-filter').is_hidden(),'Collection filters did not fold')
     return screen('screen-pokedex')
    check('audit-collection',audit_collection)
    def audit_missions():
     page.locator('.pokedex-missions-link').click()
     screen('screen-profile')
     expect(page.locator('#album-mission-gen').is_hidden(),'Mission filters should leave room for the rewards')
     page.locator('.album-mission-filter-details summary').click()
     page.locator('#album-mission-gen').select_option('6')
     expect(all('Gen 6' in t for t in page.locator('#album-mission-grid .album-mission-card').all_text_contents()),'Mission generation filter did not apply')
     page.locator('#album-mission-gen').select_option('all')
     page.locator('.album-mission-filter-details summary').click()
     first=page.locator('#album-mission-grid .album-mission-card').first
     expect('???' not in first.inner_text(),'Mission onboarding still starts with a hidden reward')
     if width<=640: expect(first.bounding_box()['y']<=height-180,'Mobile mission rewards still start too far below the fold')
     action=first.locator('button[data-action="playAlbumMission"]')
     expect(action.is_visible(),'First active mission has no route to a game')
     page.screenshot(path=str(out/f'{width}-mission-list.jpg'),quality=90,animations='disabled')
     action.click()
     expect(page.locator('#profile-album').is_hidden(),'Mission game button left the player on the mission list')
     return {'first_mission_has_game_action':True}
    check('audit-missions',audit_missions)
    check('profile',lambda:nav('profile','screen-profile'))
    def d3_profile_density():
     nav('profile','screen-profile')
     page.get_by_role('button',name='Dresseur',exact=True).click()
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
      if width>=1280:
       profile_card=page.locator('#screen-profile > .card').bounding_box()
       expect(profile_card and profile_card['width']>1200,'PC4 profile is still trapped in the old narrow desktop width: '+repr(profile_card))
       profile_layout=page.locator('#screen-profile .profile-layout')
       cols=profile_layout.evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
       expect(cols==2,'PC4 profile overview is not a two-column desktop dashboard: '+str(cols))
       stats=page.locator('#screen-profile .profile-stat-grid .profile-stat-card')
       stat_rects=stats.evaluate_all('(els)=>els.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))')
       expect(len(stat_rects)==4 and max(abs(r['y']-stat_rects[0]['y']) for r in stat_rects)<3,'PC4 profile stats are not a single desktop row: '+repr(stat_rects))
       chips=page.locator('#screen-profile .trainer-card-chip')
       chip_rects=chips.evaluate_all('(els)=>els.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))')
       expect(len(chip_rects)==4 and max(abs(r['y']-chip_rects[0]['y']) for r in chip_rects)<3,'PC4 trainer summary chips are not a desktop row: '+repr(chip_rects))
     records_details=page.locator('#screen-profile .profile-records-panel.profile-disclosure').first
     records_details.evaluate('(e)=>e.open=true')
     expect(page.locator('#profile-mode-records .profile-record-card').count()==3,'Unexpected compact record-card count')
     expect('Score Attack Gen' not in page.locator('#profile-mode-records').inner_text(),'Score Attack generations still render as separate cards')
     expect(page.locator('#profile-score-attack-record .profile-score-attack-card').count()==1,'Score Attack single-record card missing')
     page.locator('#profile-score-attack-gen').select_option('9')
     expect('530' in page.locator('#profile-score-attack-record').inner_text(),'Score Attack generation selector did not update the visible record')
     return screen('screen-profile')
    check('d3-profile-density',d3_profile_density)
    def final_history_density():
     if width<1280: return {'skipped':'desktop-only'}
     page.evaluate("""() => {
       openMatchHistoryScreen();
       document.getElementById('match-history-list').innerHTML=Array.from({length:4},(_,i)=>
         '<article class="match-history-item"><div class="match-history-main"><b>Partie '+(i+1)+'</b><span>Recette desktop</span></div></article>'
       ).join('');
     }""")
     history=page.locator('#screen-history #match-history-list')
     cols=history.evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
     expect(cols==2,'Final desktop history is not using two columns: '+str(cols))
     items=history.locator('.match-history-item')
     rects=items.evaluate_all('(els)=>els.slice(0,4).map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width}))')
     expect(len(rects)==4 and abs(rects[0]['y']-rects[1]['y'])<3 and rects[2]['y']>rects[0]['y'],'Desktop history is not a balanced two-column grid: '+repr(rects))
     expect(rects[1]['x']>rects[0]['x']+rects[0]['w']-3,'Desktop history second column is not beside the first: '+repr(rects))
     return screen('screen-history')
    check('final-history-density',final_history_density)
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
    def pc4_draft_desktop():
     if width<1280: return {'skipped':'desktop-only'}
     page.evaluate('openDraftScoreAttackMode()');screen('screen-draft-score-attack')
     card=page.locator('#screen-draft-score-attack #draft-mode-card').bounding_box()
     expect(card and card['width']>1150,'PC4 Score Attack cockpit is still narrow: '+repr(card))
     cols=page.locator('#screen-draft-score-attack #draft-mode-card').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
     expect(cols==2,'PC4 Score Attack is not a two-column cockpit: '+str(cols))
     gens=page.locator('#draft-gen-buttons button:visible')
     expect(gens.count()>=9,'Draft generation selector is incomplete')
     gen_rects=gens.evaluate_all('(els)=>els.slice(0,9).map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))')
     expect(max(abs(r['y']-gen_rects[0]['y']) for r in gen_rects)<3,'Draft generations do not fit one desktop row: '+repr(gen_rects))
     gens.first.click()
     page.wait_for_timeout(150)
     draft_options=page.locator('#screen-draft-score-attack #draft-options')
     option_cols=draft_options.evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
     expect(option_cols==(6 if width>=1680 else 3),'Final desktop Score Attack grid is unbalanced: '+str(option_cols))
     option_cards=draft_options.locator('.draft-option-card:visible')
     if option_cards.count()>=6:
      option_rects=option_cards.evaluate_all('(els)=>els.slice(0,6).map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))')
      if width>=1680:
       expect(max(abs(r['y']-option_rects[0]['y']) for r in option_rects)<3,'Six Score Attack options should share one row on wide desktop: '+repr(option_rects))
      else:
       expect(max(abs(r['y']-option_rects[0]['y']) for r in option_rects[:3])<3 and option_rects[3]['y']>option_rects[0]['y'],'Score Attack options should form a balanced 3x2 grid: '+repr(option_rects))
     picks=page.locator('#draft-mode-card > .draft-panel-picks').bounding_box()
     team=page.locator('#draft-mode-card > .draft-panel-team').bounding_box()
     expect(picks and team and team['x']>picks['x']+picks['width']-3,'Score Attack team is not beside the draft choices: '+repr([picks,team]))

     page.evaluate('openDraftArenaMode()');screen('screen-draft-arena')
     arena=page.locator('#screen-draft-arena #draft-mode-card').bounding_box()
     expect(arena and arena['width']>1150,'PC4 Draft Arena cockpit is still narrow: '+repr(arena))
     arena_cols=page.locator('#screen-draft-arena #draft-mode-card').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
     expect(arena_cols==2,'PC4 Draft Arena is not a two-column cockpit: '+str(arena_cols))
     arena_gens=page.locator('#draft-gen-buttons button:visible')
     if arena_gens.count(): arena_gens.first.click();page.wait_for_timeout(150)
     arena_picks=page.locator('#screen-draft-arena #draft-mode-card > .draft-panel-picks').bounding_box()
     arena_team=page.locator('#screen-draft-arena #draft-mode-card > .draft-panel-team').bounding_box()
     expect(arena_picks and arena_team and arena_team['x']>arena_picks['x']+arena_picks['width']-3,'Draft Arena team is not beside the choices: '+repr([arena_picks,arena_team]))
     return screen('screen-draft-arena')
    check('pc4-draft-desktop',pc4_draft_desktop)
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
      if width>=1280:
       party_card=page.locator('#screen-party-room .party-room-card').bounding_box()
       expect(party_card and party_card['width']>1200,'PC4 Party Room is still narrow on desktop: '+repr(party_card))
       play=page.locator('#screen-party-room .party-play-area').bounding_box();roster=page.locator('#screen-party-room .party-roster').bounding_box()
       expect(play and roster and roster['x']>play['x']+play['width']-3,'Party roster is not a desktop side rail: '+repr([play,roster]))
       expect(page.locator('#screen-party-room .party-roster').evaluate('(e)=>getComputedStyle(e).position')=='sticky','Party roster should stay visible on desktop')
       tiles=page.locator('#party-mode-select .party-mode-tile:visible')
       expect(tiles.count()>=6,'Party desktop game picker is unexpectedly incomplete')
       desktop_tiles=tiles.evaluate_all('(els)=>els.slice(0,4).map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,h:e.getBoundingClientRect().height}))')
       expect(abs(desktop_tiles[0]['y']-desktop_tiles[1]['y'])<3 and abs(desktop_tiles[0]['y']-desktop_tiles[2]['y'])<3 and desktop_tiles[3]['y']>desktop_tiles[0]['y'],'Party desktop picker is not a 3-column grid: '+repr(desktop_tiles))
       options_cols=page.locator('#party-options-disclosure .party-options').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
       expect(options_cols==2,'Party desktop rules are not laid out horizontally: '+str(options_cols))
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
    def connections_fairness_and_play():
     page.evaluate('restartPokeConnectionsGame()');screen('screen-poke-connections')
     fairness=page.evaluate('''() => {
      const puzzle=pokeConnectionsState.puzzle,board=puzzle.groups.flatMap(g=>g.pokemon);
      const key=ps=>ps.map(p=>Number(p.id)).sort((a,b)=>a-b).join(',');
      const expected=new Set(puzzle.groups.map(g=>key(g.pokemon))),legal=new Set();
      const values=(p,c)=>c==='type'?[p.type1,p.type2].filter(Boolean):c==='gen'?[Number(p.gen||p.generation)]:[p.color];
      for(let a=0;a<13;a++)for(let b=a+1;b<14;b++)for(let c=b+1;c<15;c++)for(let d=c+1;d<16;d++) {
       const quartet=[board[a],board[b],board[c],board[d]];
       if(!['type','gen','color'].some(category=>values(quartet[0],category).some(value=>quartet.slice(1).every(p=>values(p,category).includes(value)))))continue;
       const k=key(quartet);if(!expected.has(k))throw Error('Valid quartet would be refused: '+quartet.map(p=>p.name).join(', '));legal.add(k);
      }
      return {legalGroups:legal.size,uniquePokemon:new Set(board.map(p=>p.id)).size,themes:puzzle.groups.map(g=>g.label)};
     }''')
     expect(fairness['legalGroups']==4 and fairness['uniquePokemon']==16,'Ambiguous Connections board: '+repr(fairness))
     def choose(indices):
      for idx in indices: page.locator(f'.poke-connections-tile[data-args="[{idx}]"]').click()
      page.locator('[data-action="submitPokeConnectionsGuess"]').click()
     wrong=page.evaluate('[0,1,2,3].map(g=>pokeConnectionsState.puzzle.tiles.findIndex(t=>t.groupIdx===g))')
     choose(wrong)
     expect(page.locator('.poke-connections-mistake-dot.is-used').count()==1,'Wrong quartet did not consume exactly one mistake')
     page.locator('[data-action="clearPokeConnectionsSelection"]').click()
     for group in range(4):
      if group:
       page.locator('[data-action="shufflePokeConnectionsTiles"]').click()
       expect(page.locator('.poke-connections-tile.is-selected').count()==0,'Shuffle kept stale selection')
      indices=page.evaluate('(g)=>pokeConnectionsState.puzzle.tiles.flatMap((t,i)=>t.groupIdx===g?[i]:[])',group)
      choose(indices)
      expect(page.locator('.poke-connections-found > .poke-connections-found-row').count()==group+1,'Valid group was refused')
      expect(page.locator('.poke-connections-mistake-dot.is-used').count()==1,'Valid group consumed a mistake')
     expect(page.locator('.poke-connections-final.is-won').is_visible(),'Connections win state missing')
     expect(page.locator('.poke-connections-tile').count()==0,'Solved tiles remain selectable')
     page.evaluate('typeof closeOverlayModal === "function" && closeOverlayModal()')
     page.screenshot(path=str(out/f'{width}-connections-win.jpg'),quality=90,animations='disabled')
     page.locator('.poke-connections-final [data-action="restartPokeConnectionsGame"]').click()
     expect(page.locator('.poke-connections-tile').count()==16,'Restart did not restore 16 tiles')
     expect(page.locator('.poke-connections-mistake-dot.is-used').count()==0,'Restart kept old mistakes')
     wrong=page.evaluate('[0,1,2,3].map(g=>pokeConnectionsState.puzzle.tiles.findIndex(t=>t.groupIdx===g))')
     for attempt in range(4):
      if attempt: page.locator('[data-action="clearPokeConnectionsSelection"]').click()
      choose(wrong)
     expect(page.locator('.poke-connections-final.is-lost').is_visible(),'Connections loss state missing')
     expect(page.locator('.poke-connections-reveal-groups .is-reveal').count()==4,'Loss did not reveal four groups')
     screen('screen-poke-connections');return fairness
    check('connections-fairness-and-play',connections_fairness_and_play)
    def d2_speedrun_shell():
     page.evaluate('openSpeedrunMode()');screen('screen-speedrun');start_btn=page.locator('.speedrun-start-btn');expect('btn-blue' in (start_btn.get_attribute('class') or ''),'Speedrun start CTA is not primary blue');start_btn.click();expect(page.locator('.speedrun-pokemon').is_visible(),'Speedrun sprite stage missing');expect(page.locator('#speedrun-timer').is_visible(),'Speedrun timer missing');return screen('screen-speedrun')
    check('d2-speedrun-shell',d2_speedrun_shell)
    def d2_type_combo_shell():
     page.evaluate('openTypeComboSolo()');screen('screen-type-combo');start_btn=page.locator('.tc-start-btn');expect('btn-blue' in (start_btn.get_attribute('class') or ''),'Type Combo start CTA is not primary blue');start_btn.click();expect(page.locator('.tc-combo').is_visible(),'Type Combo prompt stage missing');expect(page.locator('#type-combo-timer').is_visible(),'Type Combo timer missing');return screen('screen-type-combo')
    check('d2-type-combo-shell',d2_type_combo_shell)
    def pc3_arcade_desktop():
     if width<1280: return {'skipped':'desktop-only'}

     page.evaluate('openOddOneOutMode()');screen('screen-odd-one-out')
     odd=page.locator('#odd-grid .odd-card')
     expect(odd.count()==6,'Intrus desktop did not render six candidates')
     odd_rects=odd.evaluate_all('(els)=>els.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,h:e.getBoundingClientRect().height}))')
     expect(max(abs(r['y']-odd_rects[0]['y']) for r in odd_rects)<3,'Intrus candidates are not one desktop row: '+repr(odd_rects))
     expect(min(r['h'] for r in odd_rects)>=200,'Intrus cards are undersized on desktop: '+repr(odd_rects))

     page.evaluate('openPokeConnectionsMode()');screen('screen-poke-connections')
     board=page.locator('.poke-connections-board')
     cols=board.evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length')
     expect(cols==2,'Connections is not using puzzle + rail desktop layout: '+str(cols))
     tiles=page.locator('.poke-connections-grid').bounding_box();status=page.locator('.poke-connections-status').bounding_box()
     expect(tiles and status and status['x']>tiles['x']+tiles['width'],'Connections status rail is not beside the puzzle: '+repr([tiles,status]))
     expect(tiles['width']>status['width']*2,'Connections puzzle does not dominate the desktop board: '+repr([tiles,status]))

     page.evaluate('openSpeedrunMode()');page.locator('.speedrun-start-btn').click();screen('screen-speedrun')
     speed_card=page.locator('#screen-speedrun .gameplay-screen-card').bounding_box()
     stage=page.locator('.speedrun-pokemon').bounding_box();speed_status=page.locator('.speedrun-status').bounding_box()
     expect(speed_card and speed_card['width']>1100,'Speedrun desktop card is still too narrow: '+repr(speed_card))
     expect(stage and speed_status and speed_status['x']>stage['x']+stage['width'],'Speedrun cockpit is not beside the Pokémon stage: '+repr([stage,speed_status]))
     expect(stage['height']>=380,'Speedrun desktop stage is too small: '+repr(stage))

     page.evaluate('openTypeComboSolo()');page.locator('.tc-start-btn').click();screen('screen-type-combo')
     combo_card=page.locator('#screen-type-combo .gameplay-screen-card').bounding_box()
     combo=page.locator('.tc-combo').bounding_box();tc_status=page.locator('.tc-status').bounding_box()
     expect(combo_card and combo_card['width']>1100,'Type Combo desktop card is still too narrow: '+repr(combo_card))
     expect(combo and tc_status and tc_status['x']>combo['x']+combo['width'],'Type Combo cockpit is not beside the prompt stage: '+repr([combo,tc_status]))
     expect(combo['height']>=380,'Type Combo desktop prompt stage is too small: '+repr(combo))

     start('startPixelGame','screen-game')
     clue=page.locator('#pixel-box').bounding_box()
     expect(clue and clue['width']>=680,'Pixel desktop visual stage did not grow: '+repr(clue))
     return screen('screen-game')
    check('pc3-arcade-desktop',pc3_arcade_desktop)
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
