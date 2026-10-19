"""Grille du jour QA with controlled API replies: cell picking, misses, PP, rarity, recovery, end and home bonus."""
import asyncio,json,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'quality-artifacts'/'grid';OUT.mkdir(parents=True,exist_ok=True)
PORT='3194'
ROWS=[dict(key='type:Feu',family='type',label='Type Feu',value='Feu'),dict(key='type:Eau',family='type',label='Type Eau',value='Eau'),dict(key='gen:1',family='gen',label='Kanto (gén. 1)',value=1)]
COLS=[dict(key='type:Vol',family='type',label='Type Vol',value='Vol'),dict(key='stage:1',family='stage',label='Stade de base',value=1,hint='N’est l’évolution d’aucun Pokémon'),dict(key='shape:dual',family='shape',label='Deux types')]
# Which cells each Pokémon answers in this controlled grid (Dracaufeu: Feu × Vol).
FITS={6:{0,8},25:set(),7:{4},1:{8,6}}
async def ready(page,condition):await page.wait_for_function('() => ('+condition+')',timeout=12000)
async def no_overflow(page):assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+2'),'horizontal overflow'
async def run():
    reports=[]
    async with async_playwright() as pw:
      for engine in ['chromium','webkit']:
        browser=await getattr(pw,engine).launch()
        for width,height in [(1366,768),(390,844)]:
          case=dict(engine=engine,width=width,ok=False);ctx=await browser.new_context(viewport=dict(width=width,height=height),is_mobile=width<640,has_touch=width<640);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(8000)
          try:
            await page.goto(f'http://127.0.0.1:{PORT}/',wait_until='domcontentloaded');await ready(page,'typeof startDailyGrid === "function" && POKEMON_LIST.length > 1000');await ready(page,'!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"');day=await page.evaluate('getDailyDateKey()')
            state=dict(cells=[None]*9,misses=[],status='ready',endReason=None);calls=[];fail_next=False
            def snapshot(extra=None):
              found=sum(1 for c in state['cells'] if c);finished=state['status']=='completed'
              out=dict(ok=True,day=day,number=211,resetAt=None,accountId=None,authenticated=False,mode='grid',label='Grille du jour',status=state['status'],finished=finished,endReason=state['endReason'],
                pp=9-found-len(state['misses']),maxPp=9,found=found,points=found*10+(10 if found==9 else 0),maxPoints=100,originality=88 if found else None,players=12,
                rows=ROWS,cols=COLS,possible=[14,9,21,30,8,25,40,12,33],cells=state['cells'],misses=state['misses'],ranked=False,rank=None,elapsedMs=None,
                reveal=[dict(popular=dict(pokemonId=[6,9,3,7,8,130,4,1,6][i],rarity=40),examples=[1,4,7,25]) for i in range(9)] if finished else None)
              if extra:out.update(extra)
              return out
            async def route_grid(route):
              nonlocal fail_next
              url=route.request.url.split('/api/daily/grid')[1].split('?')[0];body=route.request.post_data_json if route.request.method=='POST' else {}
              if url=='/guess':
                calls.append(body)
                if fail_next:fail_next=False;await route.fulfill(status=503,json=dict(ok=False,error='unavailable'));return
                await asyncio.sleep(.1);cell=body['cell'];pid=body['pokemonId'];correct=cell in FITS.get(pid,set());state['status']='playing'
                if correct:state['cells'][cell]=dict(pokemonId=pid,rarity=12)
                else:state['misses'].append(dict(cell=cell,pokemonId=pid))
                failed=[] if correct else [ROWS[cell//3]['label'],COLS[cell%3]['label']]
                await route.fulfill(json=snapshot(dict(feedback=dict(cell=cell,pokemonId=pid,correct=correct,failed=failed))));return
              if url=='/stop':state.update(status='completed',endReason='stopped')
              await route.fulfill(json=snapshot())
            async def route_summary(route):
              await route.fulfill(json=dict(ok=True,day=day,number=211,points=0,maxPoints=100,finished=False,ranked=False,stages=[dict(name=n,action=a,max=m,finished=False,points=0) for n,a,m in [('Enquête','startDailyGame',40),('Wordle','startDailyWordle',10),('Dossier','startDailyDossier',20),('Défi','startDailyChallenge',30)]]))
            await page.route('**/api/daily/grid',route_grid);await page.route('**/api/daily/grid/**',route_grid);await page.route('**/api/daily/challenge/summary',route_summary)

            await page.evaluate('startDailyGrid()');await ready(page,'dailyGridState?.status === "ready" && !dailyGridBusy')
            assert await page.locator('#grid-board button.grid-cell').count()==9;assert await page.locator('#grid-board .grid-head').count()==6
            assert 'Kanto' in await page.locator('#grid-board').inner_text();assert '9 / 9 PP' in await page.locator('#grid-hud').inner_text()
            assert await page.locator('#grid-stop').is_hidden(),'no stop button before the first guess'
            await no_overflow(page);await page.screenshot(path=str(OUT/f'{engine}-{width}-ready.png'),full_page=True)

            # A miss: the cell stays open, the name is listed as tried, one PP is gone.
            await page.locator('#grid-board button.grid-cell[data-cell="0"]').click();assert await page.locator('#grid-form').is_visible()
            assert 'Type Feu' in await page.locator('#grid-picker-title').inner_text()
            await page.locator('#grid-input').fill('Pikach');await page.locator('#grid-suggestions button',has_text='Pikachu').click()
            await ready(page,'dailyGridState.pp===8 && !dailyGridBusy');assert 'ne coche pas' in await page.locator('#grid-message').inner_text()
            assert await page.locator('#grid-form').is_visible();assert 'Pikachu' in await page.locator('#grid-picker-tried').inner_text()
            assert await page.locator('#grid-board [data-cell="0"] .grid-tried').is_visible()

            # A typed exact name is accepted with Enter; the cell fills with its rarity.
            await page.locator('#grid-input').fill('dracaufeu');await page.locator('#grid-form').evaluate('(f)=>f.requestSubmit()')
            await ready(page,'dailyGridState.found===1 && !dailyGridBusy');assert await page.locator('#grid-form').is_hidden()
            filled=page.locator('#grid-board .grid-cell.is-filled[data-cell="0"]');assert 'Dracaufeu' in await filled.inner_text();assert '12 %' in await filled.inner_text()
            assert 'Bien vu' in await page.locator('#grid-message').inner_text();assert await page.locator('#grid-stop').is_visible()
            await page.screenshot(path=str(OUT/f'{engine}-{width}-playing.png'),full_page=True)

            # A Pokémon already placed is never offered again and costs nothing.
            await page.locator('#grid-board button.grid-cell[data-cell="8"]').click();await page.locator('#grid-input').fill('Dracaufeu')
            assert await page.locator('#grid-suggestions button',has_text='Dracaufeu').count()==0
            sent=len(calls);await page.locator('#grid-form').evaluate('(f)=>f.requestSubmit()');assert len(calls)==sent;assert 'dans la liste' in await page.locator('#grid-message').inner_text()

            # The server is unreachable once: nothing changes, the next try works.
            fail_next=True;await page.locator('#grid-input').fill('Bulbizarre');await page.locator('#grid-form').evaluate('(f)=>f.requestSubmit()')
            await ready(page,'!dailyGridBusy && document.getElementById("grid-message").textContent.includes("indisponible")');assert await page.evaluate('dailyGridState.pp')==7
            await page.locator('#grid-input').fill('Bulbizarre');await page.locator('#grid-form').evaluate('(f)=>f.requestSubmit()');await ready(page,'dailyGridState.found===2 && !dailyGridBusy')
            await no_overflow(page)

            # Stop: the answers appear, the result offers sharing and the ranking.
            await page.locator('#grid-stop').click();await page.locator('#overlay-modal [data-action="stopDailyGrid"]').click()
            await ready(page,'dailyGridState?.finished && !dailyGridBusy');result=page.locator('#grid-result');assert await result.is_visible()
            text=await result.inner_text();assert '20' in text and '2 / 9 cases' in text and 'originalité 88' in text
            assert await page.locator('#grid-result [data-action="shareDailyGrid"]').is_visible();assert await page.locator('#grid-board .grid-cell.is-missed').count()==7
            assert await page.locator('#grid-board button.grid-cell').count()==0,'a finished grid takes no more picks'
            await no_overflow(page);await page.screenshot(path=str(OUT/f'{engine}-{width}-result.png'),full_page=True)

            # Home: the bonus sits under the four stages with today's result.
            await page.evaluate('goToConfig()');await ready(page,'document.getElementById("daily-hero-bonus")?.textContent.includes("20 / 100")')
            assert await page.locator('#daily-hero-bonus button').is_visible();await no_overflow(page)
            await page.locator('#daily-hero-bonus button').click();await ready(page,'!document.getElementById("screen-grid").classList.contains("hidden") && dailyGridState?.finished && !dailyGridBusy')
            assert not errors,errors
            case.update(ok=True,checks=['ready grid','miss keeps cell open','PP','typed exact name','rarity badge','used Pokémon excluded','503 recovery','stop and reveal','share','home bonus','mobile overflow'])
          except Exception as e:case['error']=str(e);await page.screenshot(path=str(OUT/f'{engine}-{width}-failure.png'),full_page=True)
          finally:reports.append(case);await ctx.close()
        await browser.close()
    (OUT/'report.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False));print('GRID',json.dumps(reports,ensure_ascii=False));assert all(r['ok'] for r in reports)
if __name__=='__main__':
    with (OUT/'server.log').open('w') as log:
      env=dict(os.environ,PORT=PORT);env.pop('DATABASE_URL',None);env.pop('PGDATABASE',None);server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',env=env,stdout=log,stderr=subprocess.STDOUT)
      try:
        for _ in range(80):
          try:urllib.request.urlopen(f'http://127.0.0.1:{PORT}/',timeout=2).close();break
          except Exception:
            if server.poll() is not None:raise RuntimeError('QA server exited')
            time.sleep(.25)
        else:raise RuntimeError('QA server unavailable')
        asyncio.run(run())
      finally:
        server.terminate()
        try:server.wait(timeout=5)
        except subprocess.TimeoutExpired:server.kill()
