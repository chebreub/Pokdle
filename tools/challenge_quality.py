"""Focused recognition journey QA with controlled API replies; no public scores."""
import asyncio,json,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'quality-artifacts'/'challenge';OUT.mkdir(parents=True,exist_ok=True)
async def ready(page,condition):await page.wait_for_function('() => ('+condition+')',timeout=12000)
async def run():
    reports=[]
    async with async_playwright() as pw:
      for engine in ['chromium','webkit']:
        browser=await getattr(pw,engine).launch()
        for width,height in [(1366,768),(390,844)]:
          case=dict(engine=engine,width=width,ok=False);ctx=await browser.new_context(viewport=dict(width=width,height=height),is_mobile=width<640,has_touch=width<640);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(8000)
          try:
            await page.goto('http://127.0.0.1:3193/',wait_until='domcontentloaded');await ready(page,'typeof startDailyChallenge === "function" && POKEMON_LIST.length > 1000');await ready(page,'!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"');day=await page.evaluate('getDailyDateKey()')
            state=dict(ok=True,day=day,number=200,accountId=None,authenticated=False,mode='zoom',label='Zoom progressif',status='ready',finished=False,index=0,total=10,maxTries=6,points=0,ranked=False,elapsedMs=None,remainingMs=180000,guesses=[],hints=[],results=[],media=None);fail_next=False;calls=[]
            def snapshot():
              state['hints']=(['Génération 1'] if len(state['guesses'])>=2 else [])+(['Type : Électrik'] if len(state['guesses'])>=4 else [])
              state['media']=f'/api/daily/challenge/media?day={day}&index={state["index"]}&attempt={len(state["guesses"])}' if state['status']=='playing' else None
              return dict(state)
            async def route_api(route):
              nonlocal fail_next
              url=route.request.url.split('/api/daily/challenge')[1].split('?')[0];body=route.request.post_data_json if route.request.method=='POST' else {}
              if url=='/media':await route.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288"><path fill="#4069e0" d="M96 48h96v48h48v96h-48v48H96v-48H48V96h48z"/></svg>');return
              if url=='/summary':await route.fulfill(json=dict(ok=True,day=day,number=200,points=42,finished=True,ranked=False,stages=[dict(name=name,action=action,max=maximum,finished=True,points=points) for name,action,maximum,points in [('Enquête','startDailyGame',10,8),('Wordle','startDailyWordle',6,4),('Dossier','startDailyDossier',20,10),('Défi','startDailyChallenge',60,20)]]));return
              if fail_next and url=='/guess':fail_next=False;await route.fulfill(status=503,json=dict(ok=False,error='unavailable'));return
              if url=='/start':state.update(status='playing')
              if url=='/abandon':state.update(status='abandoned',finished=True,points=0)
              if url=='/guess':
                calls.append(body);await asyncio.sleep(.12);pid=body['pokemonId'];guess=await page.evaluate('(id)=>({id,name:POKEMON_BY_ID.get(id).name})',pid);state['guesses'].append(guess);correct=pid==25;resolved=correct or len(state['guesses'])==6;feedback=dict(correct=correct,resolved=resolved)
                if resolved:
                  pts=7-len(state['guesses']) if correct else 0;state['results'].append(dict(correct=correct,attempts=len(state['guesses']),points=pts,pokemonId=25,name='Pikachu'));state['index']+=1;state['points']+=pts;state['guesses']=[];feedback.update(pokemonId=25,name='Pikachu',points=pts)
                await route.fulfill(json=dict(**snapshot(),feedback=feedback));return
              await route.fulfill(json=snapshot())
            await page.route('**/api/daily/challenge',route_api);await page.route('**/api/daily/challenge/**',route_api)
            await page.evaluate('startDailyChallenge()');await ready(page,'dailyChallengeState?.status === "ready" && !dailyChallengeBusy');assert await page.locator('[data-action="beginDailyChallenge"]').is_visible();await page.screenshot(path=str(OUT/f'{engine}-{width}-ready.png'),full_page=True)
            await page.locator('[data-action="beginDailyChallenge"]').click();await ready(page,'dailyChallengeState?.status === "playing" && !dailyChallengeBusy');assert await page.evaluate('document.activeElement.id === "daily-challenge-input"');await page.screenshot(path=str(OUT/f'{engine}-{width}-playing.png'),full_page=True)
            await page.locator('#daily-challenge-input').fill('Bulbizarre');await page.locator('#challenge-form').evaluate('(f)=>f.requestSubmit()');await ready(page,'dailyChallengeState.guesses.length===1 && !dailyChallengeBusy');assert await page.evaluate('document.activeElement.id === "daily-challenge-input"')
            await page.locator('#daily-challenge-input').fill('Herbizarre');await page.locator('#challenge-submit').click();await ready(page,'dailyChallengeState.guesses.length===2 && !dailyChallengeBusy');assert 'Génération 1' in await page.locator('.challenge-hints').inner_text()
            # Type while a reply is pending: the draft and focus must survive.
            await page.locator('#daily-challenge-input').fill('Florizarre');await page.locator('#challenge-form').evaluate('(f)=>f.requestSubmit()');await page.locator('#daily-challenge-input').fill('Méga');await ready(page,'dailyChallengeState.guesses.length===3 && !dailyChallengeBusy');assert await page.locator('#daily-challenge-input').input_value()=='Méga'
            fail_next=True;await page.locator('#daily-challenge-input').fill('Salamèche');await page.locator('#challenge-form').evaluate('(f)=>f.requestSubmit()');await ready(page,'!dailyChallengeBusy && document.getElementById("challenge-message").textContent.includes("injoignable")');assert len(state['guesses'])==3;assert await page.locator('#daily-challenge-input').input_value()=='Salamèche'
            await page.locator('#challenge-message [data-action="startDailyChallenge"]').click();await ready(page,'dailyChallengeState?.guesses.length===3 && !dailyChallengeBusy')
            await page.locator('#daily-challenge-input').fill('Salamèche');await page.locator('#challenge-submit').click();await ready(page,'dailyChallengeState.guesses.length===4 && !dailyChallengeBusy');assert 'Électrik' in await page.locator('.challenge-hints').inner_text()
            await page.locator('#daily-challenge-input').fill('Pikachu');await page.locator('#challenge-submit').click();await ready(page,'dailyChallengeState.index===1 && !dailyChallengeBusy');assert await page.locator('.challenge-correction').is_visible();assert state['points']==2;await page.screenshot(path=str(OUT/f'{engine}-{width}-correction.png'),full_page=True)
            await page.locator('[data-action="nextChallengePokemon"]').click();assert await page.evaluate('document.activeElement.id === "daily-challenge-input"')
            for name in ['Bulbizarre','Herbizarre','Florizarre','Salamèche','Reptincel','Dracaufeu']:
              await page.locator('#daily-challenge-input').fill(name);await page.locator('#challenge-form').evaluate('(f)=>f.requestSubmit()');await ready(page,'!dailyChallengeBusy')
            assert state['index']==2 and state['points']==2
            state.update(mode='cry',label='Cri Pokémon');await page.locator('[data-action="nextChallengePokemon"]').click();await page.evaluate('dailyChallengeState.mode="cry";renderDailyChallenge()');assert await page.locator('audio').is_visible()
            state.update(mode='pixel',label='Pixelisé');await page.evaluate('startDailyChallenge()');await ready(page,'dailyChallengeState?.mode === "pixel" && !dailyChallengeBusy');assert await page.locator('.challenge-media img').is_visible()
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+2')
            state.update(status='completed',finished=True,elapsedMs=180000,remainingMs=0);await page.evaluate('startDailyChallenge()');await ready(page,'dailyChallengeState?.finished && !dailyChallengeBusy');assert await page.locator('#challenge-result').is_visible();await page.screenshot(path=str(OUT/f'{engine}-{width}-result.png'),full_page=True)
            await page.locator('[data-action="showDailyJourneySummary"]').click();await ready(page,'document.querySelectorAll(".journey-stages button").length===4');assert await page.locator('.journey-total strong').inner_text()=='42';assert await page.locator('[data-action="openLeaderboardV2"][data-args=\'["journey","today"]\']').is_visible();await page.screenshot(path=str(OUT/f'{engine}-{width}-summary.png'),full_page=True)
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+2');assert not errors,errors
            case.update(ok=True,checks=['explicit timer start','focus','type ahead','503 recovery','reload','progressive hints','points','six-errors continue','three media variants','timeout result','four-stage summary','mobile overflow'])
          except Exception as e:case['error']=str(e);await page.screenshot(path=str(OUT/f'{engine}-{width}-failure.png'),full_page=True)
          finally:reports.append(case);await ctx.close()
        await browser.close()
    (OUT/'report.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False));print('CHALLENGE',json.dumps(reports));assert all(r['ok'] for r in reports)
if __name__=='__main__':
    with (OUT/'server.log').open('w') as log:
      env=dict(os.environ,PORT='3193');env.pop('DATABASE_URL',None);env.pop('PGDATABASE',None);server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',env=env,stdout=log,stderr=subprocess.STDOUT)
      try:
        for _ in range(80):
          try:urllib.request.urlopen('http://127.0.0.1:3193/',timeout=2).close();break
          except Exception:
            if server.poll() is not None:raise RuntimeError('QA server exited')
            time.sleep(.25)
        else:raise RuntimeError('QA server unavailable')
        asyncio.run(run())
      finally:
        server.terminate()
        try:server.wait(timeout=5)
        except subprocess.TimeoutExpired:server.kill()
