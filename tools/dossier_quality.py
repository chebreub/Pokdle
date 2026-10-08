"""Daily/Wordle -> Dossier: corrections, persistence, expert bonus, errors and mobile touch."""
import asyncio,json,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'quality-artifacts'/'dossier';OUT.mkdir(parents=True,exist_ok=True)
async def ready(page,condition):await page.wait_for_function('() => ('+condition+')',timeout=12000)
async def run():
    reports=[]
    async with async_playwright() as pw:
        for engine in ['chromium','webkit']:
            browser=await getattr(pw,engine).launch()
            for width,height in [(1366,768),(390,844)]:
                case=dict(engine=engine,width=width,ok=False);ctx=await browser.new_context(viewport=dict(width=width,height=height),is_mobile=width<640,has_touch=width<640)
                page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(8000)
                try:
                    await page.goto('http://127.0.0.1:3192/',wait_until='domcontentloaded')
                    await ready(page,'typeof startDailyDossier === "function" && POKEMON_LIST.length > 1000')
                    await ready(page,'!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                    day=await page.evaluate('getDailyDateKey()')
                    bank=json.loads(subprocess.check_output(['node','-e','process.stdout.write(JSON.stringify(require("./lib/dossier-questions").buildDossierQuestions(25,process.argv[1])))',day],cwd=ROOT/'App'))
                    state=dict(ok=True,day=day,number=200,accountId=None,authenticated=False,pokemonId=25,pokemonName='Pikachu',status='playing',finished=False,answered=0,points=0,baseCorrect=0,bonusUnlocked=False,total=10,ranked=False,elapsedMs=None,question=None,feedback=None,results=[])
                    calls=[];saved=[];fail_next=False
                    def snapshot():
                        n=len(saved);correct=sum(a['correct'] for a in saved);base=sum(a['correct'] for a in saved[:10]);bonus=n>=10 and base==10
                        finished=n==(20 if bonus else 10) or state['status']=='abandoned'
                        state.update(answered=n,points=0 if state['status']=='abandoned' else correct,baseCorrect=base,bonusUnlocked=bonus,total=20 if bonus else 10,finished=finished,elapsedMs=42000 if finished else None)
                        if finished and state['status']!='abandoned':state['status']='completed'
                        if not finished:state['question']={k:bank[n][k] for k in ['category','prompt','options']};state['question']['index']=n
                        else:state['question']=None
                        state['feedback']=dict(index=n-1,**saved[-1],**{k:bank[n-1][k] for k in ['answer','prompt','options','explanation']}) if n else None
                        state['results']=[dict(**a,**{k:bank[i][k] for k in ['answer','prompt','options','explanation']}) if finished else dict(correct=a['correct']) for i,a in enumerate(saved)]
                        return state
                    async def get(route):await route.fulfill(json=snapshot())
                    async def answer(route):
                        nonlocal fail_next
                        if fail_next:fail_next=False;await route.fulfill(status=503,json=dict(ok=False,error='unavailable'));return
                        body=route.request.post_data_json;calls.append(body);await asyncio.sleep(.15)
                        i=body['index'];choice=body['choice']
                        if i==len(saved):saved.append(dict(choice=choice,correct=choice==bank[i]['answer']))
                        await route.fulfill(json=snapshot())
                    async def abandon(route):state['status']='abandoned';await route.fulfill(json=snapshot())
                    async def wordle(route):await route.fulfill(json=dict(ok=True,day=day,number=200,accountId=None,authenticated=False,status='lost',finished=True,won=False,maxTries=6,length=10,attempts=6,points=0,ranked=False,rows=[],answerId=1,answerName='Bulbizarre'))
                    await page.route('**/api/daily/dossier',get);await page.route('**/api/daily/dossier/answer',answer);await page.route('**/api/daily/dossier/abandon',abandon);await page.route('**/api/daily/wordle',wordle)
                    await page.evaluate('startDailyWordle();closeOverlayModal()');await ready(page,'dailyWordleState?.finished && !dailyWordleBusy')
                    assert '2/4' in await page.locator('#wordle-day').inner_text()
                    next_button=page.locator('#wordle-dossier-next')
                    if width<640:await next_button.tap()
                    else:await next_button.click()
                    await ready(page,'dailyDossierState?.answered === 0 && !dailyDossierBusy')
                    assert 'answer' not in (await page.evaluate('dailyDossierState'))['question']
                    assert await page.locator('#screen-dossier').evaluate('e=>e.getBoundingClientRect().width<=781')
                    assert await page.locator('.dossier-option').count()==4
                    assert await page.locator('.dossier-heading h1').evaluate('e=>getComputedStyle(e).color === "rgb(46, 42, 51)"'), 'Legacy white h1 leaked into dossier'
                    assert 'Vérification' not in await page.locator('#dossier-message').inner_text()
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-viewport.png'))
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-start.png'),full_page=True)
                    # Wrong response preserves play; double submissions cannot advance twice.
                    wrong=(bank[0]['answer']+1)%4
                    item=page.locator('.dossier-option').nth(wrong)
                    if width<640:await item.tap()
                    else:await item.click()
                    await page.evaluate(f'answerDailyDossier(0,{wrong})')
                    await ready(page,'dailyDossierState?.answered===1 && !dailyDossierBusy')
                    assert len(calls)==1 and not state['finished'] and state['points']==0
                    assert await page.locator('.dossier-feedback').is_visible()
                    assert await page.locator('.dossier-option.correct').count()==1
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-correction.png'),full_page=True)
                    await page.reload(wait_until='domcontentloaded');await ready(page,'typeof startDailyDossier === "function"');await page.evaluate('startDailyDossier();closeOverlayModal()');await ready(page,'dailyDossierState?.answered===1 && !dailyDossierBusy')
                    assert await page.locator('.dossier-feedback').is_visible()
                    await page.locator('.dossier-continue').click();fail_next=True
                    await page.locator('.dossier-option').nth(bank[1]['answer']).click();await ready(page,'!dailyDossierBusy && document.getElementById("dossier-message").textContent.includes("injoignable")')
                    assert len(saved)==1
                    await page.locator('#dossier-message [data-action="startDailyDossier"]').click();await ready(page,'dailyDossierState?.answered===1 && !dailyDossierBusy');await page.locator('.dossier-continue').click()
                    for i in range(1,10):
                        await page.locator('.dossier-option').nth(bank[i]['answer']).click();await ready(page,f'dailyDossierState?.answered==={i+1} && !dailyDossierBusy')
                        if i<9:await page.locator('.dossier-continue').click()
                    assert state['finished'] and state['points']==9 and not state['bonusUnlocked']
                    assert await page.locator('#dossier-result').is_visible()
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-result.png'),full_page=True)
                    await page.locator('.dossier-review summary').click();assert await page.locator('.dossier-review li').count()==10
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                    # Fresh fixture: 10/10 unlocks bonus, and 20/20 remains saved on revisit.
                    saved.clear();state['status']='playing';await page.evaluate('startDailyDossier()');await ready(page,'dailyDossierState?.answered===0 && !dailyDossierBusy')
                    for i in range(10):
                        await page.locator('.dossier-option').nth(bank[i]['answer']).click();await ready(page,f'dailyDossierState?.answered==={i+1} && !dailyDossierBusy')
                        if i<9:await page.locator('.dossier-continue').click()
                    assert state['bonusUnlocked'] and not state['finished'] and state['total']==20
                    assert await page.locator('.dossier-bonus').is_visible();await page.screenshot(path=str(OUT/f'{engine}-{width}-bonus.png'),full_page=True)
                    await page.locator('.dossier-continue').click()
                    for i in range(10,20):
                        await page.locator('.dossier-option').nth(bank[i]['answer']).click();await ready(page,f'dailyDossierState?.answered==={i+1} && !dailyDossierBusy')
                        if i<19:await page.locator('.dossier-continue').click()
                    assert state['points']==20 and state['finished'];await page.screenshot(path=str(OUT/f'{engine}-{width}-expert-result.png'),full_page=True)
                    await page.evaluate('startDailyDossier()');await ready(page,'dailyDossierState?.finished && !dailyDossierBusy');assert len(saved)==20
                    saved.clear();state['status']='playing';await page.evaluate('startDailyDossier()');await ready(page,'dailyDossierState?.answered===0 && !dailyDossierBusy')
                    await page.locator('#dossier-abandon').click();await page.locator('[data-action="abandonDailyDossier"]').click();await ready(page,'dailyDossierState?.status==="abandoned" && !dailyDossierBusy');assert state['points']==0
                    assert not errors,errors
                    await page.locator('#dossier-result [data-action="goToConfig"]').click();assert await page.locator('#screen-dossier').is_hidden()
                    case.update(ok=True,checks=['Wordle loss -> dossier','no answer leak','wrong continues','double click','reload','503 recovery','9/10 end','corrections','bonus unlock','20/20','abandon','mobile overflow','return home'])
                except Exception as e:
                    case['error']=str(e);case['pageErrors']=errors;await page.screenshot(path=str(OUT/f'{engine}-{width}-failure.png'),full_page=True)
                finally:reports.append(case);await ctx.close();print('DOSSIER '+json.dumps(case),flush=True)
            await browser.close()
    (OUT/'report.json').write_text(json.dumps(reports,indent=2))
    if not all(r['ok'] for r in reports):raise SystemExit(1)
if __name__=='__main__':
    with (OUT/'server.log').open('w') as log:
        server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',stdout=log,stderr=subprocess.STDOUT,env=dict(os.environ,PORT='3192',DATABASE_URL='',DISCORD_CLIENT_ID='',DISCORD_CLIENT_SECRET=''))
        try:
            for _ in range(80):
                try:urllib.request.urlopen('http://127.0.0.1:3192/',timeout=2).close();break
                except Exception:
                    if server.poll() is not None:raise RuntimeError('QA server exited')
                    time.sleep(.25)
            else:raise RuntimeError('QA server unavailable')
            asyncio.run(run())
        finally:
            server.terminate()
            try:server.wait(timeout=5)
            except subprocess.TimeoutExpired:server.kill()
