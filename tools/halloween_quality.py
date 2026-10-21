"""Seasonal visuals: Chromium/WebKit, layout stability, opt-out and game isolation."""
import asyncio, json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'halloween'
OUT.mkdir(parents=True, exist_ok=True)

async def run():
    results = []
    async with async_playwright() as pw:
        for engine in os.environ.get('HALLOWEEN_QA_ENGINES', 'chromium,webkit').split(','):
            launch_options = json.loads(Path(os.environ['HALLOWEEN_QA_LAUNCH']).read_text()) if os.environ.get('HALLOWEEN_QA_LAUNCH') else {}
            browser = await getattr(pw, engine).launch(**launch_options)
            for width, height in [(1366, 900), (390, 844)]:
                context = await browser.new_context(viewport=dict(width=width, height=height),
                                                   is_mobile=width < 640, has_touch=width < 640)
                # Keep this seasonal test meaningful when CI runs outside October.
                await context.add_init_script('''{
                  Math.random = () => .6; // Reproducible visitor and crossing in this fixture.
                  const OriginalDate = Date;
                  window.Date = class extends OriginalDate {
                    constructor(...args) { super(...(args.length ? args : ['2026-10-21T12:00:00Z'])); }
                  };
                }''')
                page = await context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                async def summary(route):
                    await route.fulfill(json=dict(ok=True, day='2026-10-21', points=0, maxPoints=100,
                        stages=[dict(finished=False, points=0, max=25) for _ in range(4)]))
                await page.route('**/api/daily/challenge/summary', summary)
                await page.goto('http://127.0.0.1:3199/', wait_until='domcontentloaded')
                await page.wait_for_selector('.halloween-hat')
                await page.wait_for_function('() => !document.getElementById("app-splash")')
                assert await page.locator('.halloween-pumpkin img').evaluate('e => e.complete && e.naturalWidth > 0')
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                await page.screenshot(path=str(OUT / f'{engine}-{width}-layout.png'))
                hat_box = await page.locator('.halloween-hat').bounding_box()
                assert hat_box['y'] >= 0, hat_box
                before = await page.locator('#daily-hero').bounding_box()
                await page.screenshot(path=str(OUT / f'{engine}-{width}-light.png'))
                # A real scheduled visitor must appear, and never intercept a click.
                await page.wait_for_selector('.halloween-visitor', state='attached', timeout=16000)
                assert await page.locator('.halloween-visitor').count() == 1
                assert await page.locator('.halloween-crossing').count() == (1 if width > 640 else 0)
                assert await page.locator('.halloween-visitor img').evaluate('e => e.complete && e.naturalWidth > 0')
                assert await page.locator('#halloween-stage').evaluate('e => getComputedStyle(e).pointerEvents === "none"')
                await page.wait_for_timeout(2200)
                await page.screenshot(path=str(OUT / f'{engine}-{width}-visitor.png'))
                await page.evaluate('openSettingsModal()')
                await page.wait_for_function('() => !document.querySelector(".halloween-visitor")')
                setting = page.locator('[data-setting="seasonalDecorations"]')
                await setting.uncheck()
                await page.wait_for_function('() => !document.querySelector(".halloween-hat")')
                await page.evaluate('closeOverlayModal()')
                after = await page.locator('#daily-hero').bounding_box()
                assert before == after, (before, after)
                await page.reload(wait_until='domcontentloaded')
                await page.wait_for_function('() => typeof openSettingsModal === "function"')
                assert await page.locator('.halloween-hat').count() == 0
                await page.evaluate('openSettingsModal()')
                await page.locator('[data-setting="seasonalDecorations"]').check()
                await page.locator('[data-setting="theme"]').select_option('dark')
                await page.evaluate('closeOverlayModal()')
                await page.wait_for_selector('.halloween-hat')
                await page.screenshot(path=str(OUT / f'{engine}-{width}-dark.png'))
                # Game screens keep their original feedback and have no visitor timer.
                await page.evaluate('startNormalGame()')
                await page.wait_for_function('() => document.body.dataset.screen === "screen-game"')
                await page.wait_for_timeout(7000)
                assert await page.locator('.halloween-visitor').count() == 0
                await page.screenshot(path=str(OUT / f'{engine}-{width}-game.png'))
                await page.emulate_media(reduced_motion='reduce')
                await page.evaluate('goToConfig()')
                await page.wait_for_timeout(7000)
                assert await page.locator('.halloween-visitor').count() == 0
                assert await page.locator('.halloween-hat').count() == 1
                assert not errors, errors
                results.append(dict(engine=engine, width=width, ok=True))
                await context.close()
            await browser.close()
    (OUT / 'report.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    env = dict(os.environ, PORT='3199', NODE_ENV='test')
    server = subprocess.Popen(['node', 'server.js'], cwd=ROOT / 'App', env=env,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen('http://127.0.0.1:3199/api/multiplayer/health', timeout=1)
                break
            except Exception:
                time.sleep(.1)
        asyncio.run(run())
    finally:
        server.terminate()
        server.wait(timeout=10)
