"""Exercise consecutive guesses with delayed server replies and normal animations."""
import asyncio, json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'guess-flow'
OUT.mkdir(parents=True, exist_ok=True)

async def ready(page, expression):
    await page.wait_for_function('() => (' + expression + ')', timeout=12000)

async def run():
    results = []
    async with async_playwright() as pw:
        for engine in ['chromium', 'webkit']:
            browser = await getattr(pw, engine).launch()
            for width, height in [(1366, 768), (390, 844)]:
                case = {'engine': engine, 'width': width, 'ok': False}
                context = await browser.new_context(viewport={'width': width, 'height': height},
                    is_mobile=width < 640, has_touch=width < 640, reduced_motion='no-preference')
                page = await context.new_page()
                page.set_default_timeout(8000)
                try:
                    await page.goto('http://127.0.0.1:3190/', wait_until='domcontentloaded')
                    await ready(page, 'typeof startDailyGame === "function" && POKEMON_LIST.length > 1000')
                    await ready(page, '!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                    day = await page.evaluate('getDailyDateKey()')
                    state = dict(ok=True, day=day, number=199, accountId=None, authenticated=False,
                        status='playing', finished=False, won=False, attempts=0, rows=[], streak={})
                    requests = []
                    async def daily(route):
                        await route.fulfill(json=state)
                    async def guess(route):
                        body = route.request.post_data_json
                        requests.append(body['pokemonId'])
                        await asyncio.sleep(.6)
                        won = body['pokemonId'] == 1
                        cmp = {key: 'ok' if won else 'wrong' for key in
                            ['generation', 'altForm', 'type1', 'type2', 'habitat', 'color', 'stage', 'height', 'weight']}
                        state['rows'].append(dict(pokemonId=body['pokemonId'], cmp=cmp, heightDirection='↑', weightDirection='↑'))
                        state['attempts'] = len(state['rows'])
                        if won: state.update(status='won', finished=True, won=True, answerId=1, fresh=True)
                        await route.fulfill(json=state)
                    await page.route('**/api/daily', daily)
                    await page.route('**/api/daily/guess', guess)
                    await page.evaluate('startDailyGame();closeOverlayModal()')
                    await ready(page, 'dailyServerState?.status === "playing" && !dailyRequestInFlight')
                    field = page.locator('#guess-input')
                    await field.fill('Pikachu')
                    suggestion = page.locator('#guess-ac .ac-item').filter(has=page.locator('.ac-name', has_text='Pikachu')).first
                    if width < 640: await suggestion.tap()
                    else: await suggestion.click()
                    assert await field.evaluate('e => document.activeElement === e && !e.disabled && e.value === ""'), 'Input lost focus or was blocked during request'
                    assert await page.locator('#btn-submit').is_disabled()
                    await page.keyboard.type('Salam')
                    await page.keyboard.press('Enter')  # Must not submit while the first reply is pending.
                    await ready(page, 'attempts === 1 && !dailyRequestInFlight')
                    assert requests == [25], requests
                    assert await field.input_value() == 'Salam', 'Next draft was erased by reply'
                    assert await field.evaluate('e => document.activeElement === e'), 'Reply stole focus'
                    await page.evaluate('window.firstGuessRow=document.querySelector("#results-body tr")')
                    await page.keyboard.type('èche')
                    await page.keyboard.press('Enter')
                    await ready(page, 'attempts === 2 && !dailyRequestInFlight')
                    assert requests == [25, 4], requests
                    assert await page.evaluate('firstGuessRow === document.querySelector("#results-body tr")'), 'Old row was rebuilt'
                    cells = await page.locator('#results-body tr:last-child td').evaluate_all('''cells => cells.map(e => {
                        const s=getComputedStyle(e);return {opacity:Number(s.opacity),delay:s.animationDelay,duration:s.animationDuration};
                    })''')
                    assert all(c['opacity'] == 1 and c['delay'] == '0s' and float(c['duration'].rstrip('s')) <= .2 for c in cells), cells
                    assert await field.evaluate('e => document.activeElement === e'), 'Second guess lost focus'
                    await page.keyboard.type('Carapuce')
                    button = page.locator('#btn-submit')
                    if width < 640: await button.tap()
                    else: await button.click()
                    await ready(page, 'attempts === 3 && !dailyRequestInFlight')
                    assert await field.evaluate('e => document.activeElement === e'), 'Submit button did not restore focus'
                    if width < 640:
                        await ready(page, '''document.querySelector('.search-bar').getBoundingClientRect().bottom <= document.getElementById('mobile-tabbar').getBoundingClientRect().top - 7''')
                    await page.screenshot(path=str(OUT / f'{engine}-{width}-consecutive.png'))
                    for query, name, count in [('mega florizarre', 'Méga-Florizarre', 4), ('rattata', "Rattata d'Alola", 5)]:
                        await field.fill(query)
                        form = page.locator('#guess-ac .ac-item').filter(has=page.get_by_text(name, exact=True))
                        if width < 640: await form.tap()
                        else: await form.click()
                        await ready(page, f'attempts === {count} && !dailyRequestInFlight')
                        assert name in await page.locator('#results-body tr:last-child').inner_text()
                        assert await page.evaluate('secretPokemon === null'), 'Form guess exposed the Daily target'
                    await page.screenshot(path=str(OUT / f'{engine}-{width}-forms.png'))
                    await page.keyboard.type('Bulbizarre')
                    await page.keyboard.press('Enter')
                    await ready(page, 'gameOver && !dailyRequestInFlight')
                    assert await field.is_hidden(), 'Winning round retained the input'
                    # Unlimited uses the same immediate feedback without any Daily request.
                    await page.evaluate('gameMode="normal";startGameWithSecret(POKEMON_BY_ID.get(1),POKEMON_LIST)')
                    await field.fill('Pikachu');await page.keyboard.press('Enter')
                    assert await field.evaluate('e => document.activeElement === e && e.value === ""')
                    await page.keyboard.type('Salamèche');await page.keyboard.press('Enter')
                    assert await page.evaluate('attempts === 2 && !gameOver')
                    assert requests == [25, 4, 7, 20001, 21001, 1], requests
                    case.update(ok=True, dailyRequests=requests, cells=cells)
                except Exception as error:
                    case['error'] = str(error)
                    await page.screenshot(path=str(OUT / f'{engine}-{width}-failure.png'))
                finally:
                    await context.close()
                    results.append(case)
                    print('GUESS_FLOW ' + json.dumps(case), flush=True)
            await browser.close()
    (OUT / 'report.json').write_text(json.dumps(results, indent=2))
    if not all(case['ok'] for case in results): raise SystemExit(1)

if __name__ == '__main__':
    with (OUT / 'server.log').open('w') as log:
        server = subprocess.Popen(['node', 'server.js'], cwd=ROOT / 'App', stdout=log, stderr=subprocess.STDOUT,
            env=dict(os.environ, PORT='3190', DATABASE_URL='', DISCORD_CLIENT_ID='', DISCORD_CLIENT_SECRET=''))
        try:
            for _ in range(80):
                try:
                    urllib.request.urlopen('http://127.0.0.1:3190/', timeout=2).close(); break
                except Exception:
                    if server.poll() is not None: raise RuntimeError('QA server exited')
                    time.sleep(.25)
            else: raise RuntimeError('QA server did not start')
            asyncio.run(run())
        finally:
            server.terminate()
            try: server.wait(timeout=5)
            except subprocess.TimeoutExpired: server.kill()
