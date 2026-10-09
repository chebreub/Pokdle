"""Daily -> Wordle, delayed replies, touch/keyboard, reload, win/loss and screenshots."""
import asyncio, json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'quality-artifacts'/'wordle'
OUT.mkdir(parents=True,exist_ok=True)

async def ready(page, expression):
    await page.wait_for_function('() => ('+expression+')',timeout=12000)

def colors(guess,answer='BULBIZARRE'):
    result=['absent']*len(guess);remaining={}
    for i,letter in enumerate(answer):
        if i<len(guess) and guess[i]==letter: result[i]='exact'
        else: remaining[letter]=remaining.get(letter,0)+1
    for i,letter in enumerate(guess):
        if result[i]!='exact' and remaining.get(letter,0):
            result[i]='present';remaining[letter]-=1
    return result

async def run():
    reports=[]
    async with async_playwright() as pw:
        for engine in ['chromium','webkit']:
            browser=await getattr(pw,engine).launch()
            for width,height in [(1366,768),(390,844)]:
                case=dict(engine=engine,width=width,ok=False)
                context=await browser.new_context(viewport=dict(width=width,height=height),is_mobile=width<640,has_touch=width<640)
                page=await context.new_page();page.set_default_timeout(8000)
                errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                try:
                    await page.goto('http://127.0.0.1:3191/',wait_until='domcontentloaded')
                    await ready(page,'typeof startDailyWordle === "function" && POKEMON_LIST.length > 1000')
                    await ready(page,'!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                    day=await page.evaluate('getDailyDateKey()')
                    state=dict(ok=True,day=day,number=200,accountId=None,authenticated=False,status='playing',finished=False,won=False,maxTries=6,length=10,attempts=0,points=0,ranked=False,rows=[])
                    calls=[];fail_next=False
                    async def daily(route):
                        await route.fulfill(json=dict(ok=True,day=day,number=200,accountId=None,authenticated=False,status='abandoned',finished=True,won=False,attempts=0,answerId=25,rows=[],streak={}))
                    async def wordle(route): await route.fulfill(json=state)
                    async def guess(route):
                        nonlocal fail_next
                        if fail_next:
                            fail_next=False;await route.fulfill(status=503,json=dict(ok=False,error='unavailable'));return
                        body=route.request.post_data_json;pid=body['pokemonId'];calls.append(pid)
                        await asyncio.sleep(.4)
                        names={25:('Pikachu','PIKACHU'),4:('Salamèche','SALAMECHE'),7:('Carapuce','CARAPUCE'),133:('Évoli','EVOLI'),151:('Mew','MEW'),6:('Dracaufeu','DRACAUFEU'),1:('Bulbizarre','BULBIZARRE')}
                        name,letters=names[pid];state['rows'].append(dict(pokemonId=pid,name=name,letters=letters,colors=colors(letters)))
                        state['attempts']=len(state['rows'])
                        if pid==1 or state['attempts']==6:
                            state.update(status='won' if pid==1 else 'lost',finished=True,won=pid==1,points=7-state['attempts'] if pid==1 else 0,answerId=1,answerName='Bulbizarre')
                        await route.fulfill(json=state)
                    await page.route('**/api/daily',daily)
                    await page.route('**/api/daily/wordle',wordle)
                    await page.route('**/api/daily/wordle/guess',guess)
                    await page.evaluate('startDailyGame();closeOverlayModal()')
                    await ready(page,'gameOver && !dailyRequestInFlight')
                    next_button=page.locator('#daily-wordle-next')
                    assert await page.locator('#win-box').evaluate('e=>e.classList.contains("daily-result-card")')
                    assert await page.locator('#win-box').evaluate('e=>e.getBoundingClientRect().height < 480'), 'Enquiry result too tall'
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-enquiry-result.png'),full_page=True)
                    if width<640: await next_button.tap()
                    else: await next_button.click()
                    await ready(page,'dailyWordleState?.status === "playing" && !dailyWordleBusy')
                    assert 'answerName' not in await page.evaluate('dailyWordleState')
                    assert await page.locator('.wordle-mystery .wordle-cell').count()==10
                    assert await page.locator('#screen-wordle').evaluate('e => e.getBoundingClientRect().width <= 781'), 'Wordle card stretched by legacy screen CSS'
                    assert await page.locator('.wordle-heading').evaluate('e => getComputedStyle(e).backgroundColor === "rgba(0, 0, 0, 0)"'), 'Legacy header background leaked into Wordle'
                    if width<640:
                        assert await page.locator('#wordle-form').evaluate('e => e.getBoundingClientRect().bottom < document.getElementById("mobile-tabbar").getBoundingClientRect().top - 7'), 'Initial input hidden under mobile navigation'
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-start.png'))
                    field=page.locator('#wordle-input')
                    await field.fill('FAUXNOM');await page.locator('#wordle-submit').click()
                    assert calls==[],calls
                    await field.fill('Pika')
                    item=page.locator('#wordle-suggestions button',has_text='Pikachu').first
                    if width<640: await item.tap()
                    else: await item.click()
                    assert await field.evaluate('e => document.activeElement === e && !e.disabled && e.value === ""')
                    await page.keyboard.type('Salam')
                    await page.keyboard.press('Enter')
                    await ready(page,'dailyWordleState?.attempts === 1 && !dailyWordleBusy')
                    assert calls==[25] and await field.input_value()=='Salam'
                    assert await field.evaluate('e => document.activeElement === e')
                    await page.keyboard.type('èche');await page.keyboard.press('Enter')
                    await ready(page,'dailyWordleState?.attempts === 2 && !dailyWordleBusy')
                    assert await field.evaluate('e => document.activeElement === e')
                    if width<640:
                        await ready(page,'document.getElementById("wordle-form").getBoundingClientRect().bottom < document.getElementById("mobile-tabbar").getBoundingClientRect().top - 7')
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-playing.png'))
                    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), 'Horizontal page overflow'
                    await field.fill('Pikachu');await page.keyboard.press('Enter');assert calls==[25,4]
                    await page.reload(wait_until='domcontentloaded');await ready(page,'typeof startDailyWordle === "function"')
                    await page.evaluate('startDailyWordle();closeOverlayModal()');await ready(page,'dailyWordleState?.attempts === 2 && !dailyWordleBusy')
                    assert await page.locator('.wordle-guess:not(.wordle-next)').count()==2
                    # Use the virtual keyboard to submit a real name without native typing.
                    for letter in 'MEW':
                        button=page.locator('#wordle-keyboard [data-letter="'+letter+'"]')
                        if width<640: await button.tap()
                        else: await button.click()
                    await page.locator('#wordle-keyboard button',has_text='Valider').click()
                    await ready(page,'dailyWordleState?.attempts === 3 && !dailyWordleBusy')
                    fail_next=True;await field.fill('Carapuce');await page.keyboard.press('Enter')
                    await ready(page,'!dailyWordleBusy && document.getElementById("wordle-message").textContent.includes("injoignable")')
                    assert await field.input_value()=='Carapuce' and state['attempts']==3
                    await field.fill('Bulbizarre');await page.keyboard.press('Enter')
                    await ready(page,'dailyWordleState?.won && !dailyWordleBusy')
                    assert await page.locator('#wordle-form').is_hidden()
                    assert await page.locator('#wordle-result').is_visible()
                    assert await page.locator('#wordle-result h2').inner_text()=='Bulbizarre'
                    assert state['points']==3
                    assert await page.locator('#wordle-result').evaluate('e=>e.getBoundingClientRect().height < 480'), 'Result card too tall'
                    assert await page.locator('#daily-wordle-grid-review').evaluate('e=>!e.open'), 'Grid must start collapsed'
                    await page.locator('#daily-wordle-grid-review summary').click()
                    assert await page.locator('#wordle-board').is_visible()
                    await page.locator('#daily-wordle-grid-review summary').click()
                    await page.locator('#wordle-result').scroll_into_view_if_needed()
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-win.png'))
                    await page.evaluate('startDailyWordle()');await ready(page,'dailyWordleState?.won && !dailyWordleBusy')
                    assert calls==[25,4,151,1]
                    # Another isolated daily fixture covers all six misses and zero points.
                    state.update(status='playing',finished=False,won=False,points=0,attempts=0,rows=[]);state.pop('answerId');state.pop('answerName')
                    await page.evaluate('startDailyWordle()');await ready(page,'dailyWordleState?.status === "playing" && !dailyWordleBusy')
                    for attempt,name in enumerate(['Pikachu','Salamèche','Carapuce','Évoli','Mew','Dracaufeu'],1):
                        await field.fill(name);await page.keyboard.press('Enter')
                        await ready(page,f'dailyWordleState?.attempts === {attempt} && !dailyWordleBusy')
                    assert state['status']=='lost' and state['points']==0
                    assert await page.locator('#wordle-keyboard').is_hidden()
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-loss.png'))
                    await page.locator('#wordle-result [data-action="goToConfig"]').click()
                    assert await page.locator('#screen-wordle').is_hidden()
                    assert not errors,errors
                    case.update(ok=True,checks=['Daily abandon -> Wordle','private target','invalid/duplicate free','delayed focus/draft','virtual keyboard','reload','503 retry','win','6-try loss','return home'])
                except Exception as e:
                    case['error']=str(e);case['pageErrors']=errors
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-failure.png'))
                finally:
                    reports.append(case);await context.close();print('WORDLE '+json.dumps(case),flush=True)
            await browser.close()
    (OUT/'report.json').write_text(json.dumps(reports,indent=2))
    if not all(r['ok'] for r in reports): raise SystemExit(1)

if __name__=='__main__':
    with (OUT/'server.log').open('w') as log:
        server=subprocess.Popen(['node','server.js'],cwd=ROOT/'App',stdout=log,stderr=subprocess.STDOUT,env=dict(os.environ,PORT='3191',DATABASE_URL='',DISCORD_CLIENT_ID='',DISCORD_CLIENT_SECRET=''))
        try:
            for _ in range(80):
                try: urllib.request.urlopen('http://127.0.0.1:3191/',timeout=2).close();break
                except Exception:
                    if server.poll() is not None: raise RuntimeError('QA server exited')
                    time.sleep(.25)
            else: raise RuntimeError('QA server unavailable')
            asyncio.run(run())
        finally:
            server.terminate()
            try: server.wait(timeout=5)
            except subprocess.TimeoutExpired: server.kill()
