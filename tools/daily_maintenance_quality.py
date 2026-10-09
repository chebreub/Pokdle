"""PR 2: home journey restoration, Quiz, League launch and Daily counter only."""
import asyncio,json,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
from wordle_quality import ready
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'quality-artifacts'/'daily-maintenance'
OUT.mkdir(parents=True,exist_ok=True)

async def run():
  reports=[]
  async with async_playwright() as pw:
    for engine in ['chromium','webkit']:
      browser=await getattr(pw,engine).launch()
      for width,height in [(1366,768),(390,844)]:
        ctx=await browser.new_context(viewport=dict(width=width,height=height),is_mobile=width<640,has_touch=width<640,reduced_motion='reduce')
        page=await ctx.new_page();case=dict(engine=engine,width=width,ok=False)
        try:
          await page.goto('http://127.0.0.1:3194/',wait_until='domcontentloaded')
          await ready(page,'typeof refreshDailyHomeSummary === "function" && POKEMON_LIST.length>1000')
          day=await page.evaluate('getDailyDateKey()')
          summary=dict(ok=True,day=day,number=201,points=42,maxPoints=100,finished=False,ranked=False,stages=[])
          async def status(route):await route.fulfill(json=summary)
          await page.route('**/api/daily/challenge/summary',status)
          actions=['startDailyGame','startDailyWordle','startDailyDossier','startDailyChallenge','showDailyJourneySummary']
          for n in range(5):
            summary.update(finished=n==4,stages=[dict(finished=i<n,points=0,max=[40,10,20,30][i]) for i in range(4)])
            await page.evaluate('invalidateDailyHomeSummary();goToConfig();closeOverlayModal()')
            await ready(page,'document.getElementById("daily-hero-cta").dataset.action === '+json.dumps(actions[n])+' && dailyHomeSnapshot?.revision === dailyHomeRevision')
            assert await page.locator('#daily-wordle-home').is_hidden()
            if n in [2,4]:await page.screenshot(path=str(OUT/f'{engine}-{width}-home-{n}.png'),full_page=True)
          assert '42 / 100' in await page.locator('#daily-hero-status').inner_text()
          assert await page.locator('#daily-notebook').is_hidden(), 'Finished journey must not show an empty enquiry notebook'
          await page.reload(wait_until='domcontentloaded')
          await ready(page,'document.getElementById("daily-hero-status").textContent.includes("Journée terminée")')
          assert await page.locator('#daily-hero-cta').get_attribute('data-action')=='showDailyJourneySummary'
          await page.evaluate('startQuizGame();closeOverlayModal()')
          assert await page.evaluate('quizQuestions.length')==15
          assert '1 / 15' in await page.locator('#quiz-progress').inner_text()
          await page.screenshot(path=str(OUT/f'{engine}-{width}-quiz.png'),full_page=True)
          await page.evaluate('goToConfig();weeklyLeagueLaunch("speedrun")')
          assert await page.locator('#screen-speedrun').is_visible()
          assert await page.evaluate('speedrunState.phase')=='playing'
          await page.evaluate('goToConfig();weeklyLeagueLaunch("higherlower")')
          assert await page.locator('#screen-higher-lower').is_visible()
          assert await page.evaluate('higherLowerState.mode')=='infinite'
          daily=dict(ok=True,day=day,number=201,accountId=None,authenticated=False,status='playing',finished=False,won=False,attempts=0,rows=[],streak={},points=0)
          async def state(route):await route.fulfill(json=daily)
          await page.route('**/api/daily',state)
          await page.evaluate('goToConfig();playerStats.lastDailyStartedKey=null;startDailyGame();closeOverlayModal()')
          await ready(page,'dailyServerState && !dailyRequestInFlight')
          count=await page.evaluate('playerStats.played')
          await page.evaluate('startDailyGame()');await ready(page,'dailyServerState && !dailyRequestInFlight')
          assert await page.evaluate('playerStats.played')==count
          daily.update(status='won',finished=True,won=True,answerId=25,points=40,maxPoints=40,attempts=1,rows=[dict(pokemonId=25,cmp={key:'ok' for key in ['generation','altForm','type1','type2','habitat','color','stage','height','weight']},heightDirection='',weightDirection='')])
          await page.evaluate('startDailyGame()');await ready(page,'gameOver && !dailyRequestInFlight')
          assert '40 / 40' in await page.locator('#daily-enquiry-points').inner_text()
          assert await page.evaluate('playerStats.played')==count
          assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
          await page.screenshot(path=str(OUT/f'{engine}-{width}-enquiry-points.png'),full_page=True)
          case['ok']=True
        except Exception as e:
          case['error']=str(e);await page.screenshot(path=str(OUT/f'{engine}-{width}-failure.png'),full_page=True)
        finally:reports.append(case);await ctx.close()
      await browser.close()
  (OUT/'report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports));assert all(c['ok'] for c in reports)

if __name__=='__main__':
  with (OUT/'server.log').open('w') as log:
    env=dict(os.environ,PORT='3194');env.pop('DATABASE_URL',None);env.pop('PGDATABASE',None)
    server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',env=env,stdout=log,stderr=subprocess.STDOUT)
    try:
      for _ in range(80):
        try:urllib.request.urlopen('http://127.0.0.1:3194/',timeout=2).close();break
        except Exception:time.sleep(.25)
      asyncio.run(run())
    finally:server.terminate();server.wait(timeout=10)
