"""Seasonal visuals: Chromium/WebKit, pumpkin artwork, real viewport flights, scrolling and usable controls."""
import asyncio, json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'halloween'
OUT.mkdir(parents=True, exist_ok=True)

async def assert_controls_clear(page):
    # Inspect the animated, rendered bounds rather than just the placement calculation.
    overlaps = await page.evaluate('''() => {
        const actor = document.querySelector('.halloween-visitor');
        if (!actor || Number(getComputedStyle(actor).opacity) < .2) return [];
        const a = actor.getBoundingClientRect();
        if (actor.dataset.motion === 'travel') {
            const hit = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, a.x + a.width/2)),
                                                 Math.max(0, Math.min(innerHeight - 1, a.y + a.height/2)));
            return actor.contains(hit) ? ['decorative actor intercepted the pointer'] : [];
        }
        return [...document.querySelectorAll('button, input, select, textarea, table, [role="listbox"]')]
          .filter(e => {
            const b = e.getBoundingClientRect();
            return b.width && b.height && b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top;
          }).map(e => e.id || e.className);
    }''')
    assert not overlaps, overlaps


async def assert_mobile_ornaments(page):
    result = await page.evaluate('''() => {
        const nav = document.querySelector('#mobile-tabbar');
        const art = nav.querySelector('.halloween-nav-pumpkins img');
        const decor = nav.querySelector('.halloween-nav-decor');
        const a = art.getBoundingClientRect(), d = decor.getBoundingClientRect(), n = nav.getBoundingClientRect();
        const buttons = [...nav.querySelectorAll('button')].map(e => e.getBoundingClientRect());
        // Temporarily include only this inert image in hit testing to verify its painted layer.
        art.style.setProperty('pointer-events', 'auto', 'important');
        let topmost, hit;
        const navStyle = getComputedStyle(nav);
        try { hit = document.elementFromPoint(a.x + a.width/2, a.y + a.height/2); topmost = hit === art; }
        finally { art.style.removeProperty('pointer-events'); }
        return {
            decoded: art.complete && art.naturalWidth > 0,
            topmost,
            inViewport: a.x >= 0 && a.y >= 0 && a.right <= innerWidth && a.bottom <= innerHeight,
            inNav: d.y >= n.y && d.bottom <= Math.min(...buttons.map(b => b.y)) - 2,
            targets: buttons.length === 5 && buttons.every(b => b.width >= 44 && b.height >= 44),
            noInterception: getComputedStyle(art).pointerEvents === 'none',
            padding: parseFloat(getComputedStyle(document.body).paddingBottom) >= n.height + 12,
            overflow: document.documentElement.scrollWidth <= innerWidth + 1,
            diagnostic: {hit:hit?.outerHTML?.slice(0,500), navTransform:navStyle.transform, navOpacity:navStyle.opacity, navVisibility:navStyle.visibility, body:document.body.className, x:a.x, y:a.y}
        };
    }''')
    assert all(result.values()), result

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
                  Math.random = () => .6; // Reproducible artwork and placements.
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
                await page.wait_for_function('() => { const img = document.querySelector(".halloween-pumpkin img"); return img?.complete && img.naturalWidth > 0; }')
                art = await page.locator('.halloween-pumpkin').bounding_box()
                for selector in ['#daily-notebook', '#daily-hero-cta', '.halloween-season-label']:
                    box = await page.locator(selector).bounding_box()
                    assert box is None or not (art['x'] < box['x'] + box['width'] and art['x'] + art['width'] > box['x']
                        and art['y'] < box['y'] + box['height'] and art['y'] + art['height'] > box['y']), (selector, art, box)
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                if width < 640:
                    for mobile_width in [320, 390, 430]:
                        await page.set_viewport_size(dict(width=mobile_width, height=height))
                        await assert_mobile_ornaments(page)
                        pumpkin = await page.locator('.halloween-pumpkin').bounding_box()
                        label = await page.locator('.halloween-season-label').bounding_box()
                        assert pumpkin['x'] >= label['x'] + label['width'] or pumpkin['y'] >= label['y'] + label['height'], (mobile_width, pumpkin, label)
                        await page.screenshot(path=str(OUT / f'{engine}-{mobile_width}-mobile-ornaments.png'))
                    await page.set_viewport_size(dict(width=width, height=height))
                await page.screenshot(path=str(OUT / f'{engine}-{width}-layout.png'))
                hat_box = await page.locator('.halloween-hat').bounding_box()
                assert hat_box['y'] >= 0, hat_box
                ball_box = await page.locator('#logo-home .pokeball-icon').bounding_box()
                costume_box = await page.locator('.halloween-logo-costume').bounding_box()
                assert costume_box == ball_box, (costume_box, ball_box)
                assert abs(hat_box['x'] + hat_box['width']/2 - ball_box['x'] - ball_box['width']/2) < 1
                assert ball_box['y'] + 3 < hat_box['y'] + hat_box['height'] < ball_box['y'] + ball_box['height'] * .55
                assert await page.locator('#halloween-frame').count() == 1
                before = await page.locator('#daily-hero').bounding_box()
                cta_before = await page.locator('#daily-hero-cta').bounding_box()
                await page.screenshot(path=str(OUT / f'{engine}-{width}-light.png'))
                # A real scheduled flyby must travel across the viewport and survive scrolling.
                await page.wait_for_selector('.halloween-visitor[data-motion="travel"]', state='attached', timeout=22000)
                await page.evaluate('''() => {
                    window.__halloweenQAActor = document.querySelector('.halloween-visitor[data-motion="travel"]');
                    window.__halloweenQAActor.getAnimations()[0].currentTime = 1000;
                }''')
                first_position = await page.locator('.halloween-visitor').bounding_box()
                await page.wait_for_timeout(1200)
                second_position = await page.locator('.halloween-visitor').bounding_box()
                assert abs(second_position['x'] - first_position['x']) > width * .06, (first_position, second_position)
                # A touch-scroll starting on a button does not constitute a click.
                await page.locator('#daily-hero-cta').dispatch_event('pointerdown', {'pointerType':'touch'})
                assert await page.evaluate('window.__halloweenQAActor.isConnected')
                await page.evaluate('window.scrollBy(0, 180)')
                await page.wait_for_timeout(350)
                assert await page.evaluate('window.__halloweenQAActor.isConnected')
                if width < 640:
                    await assert_mobile_ornaments(page)
                await page.keyboard.press('PageDown')
                await page.wait_for_timeout(200)
                assert await page.evaluate('window.__halloweenQAActor.isConnected')
                await page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
                await page.wait_for_function('() => scrollY < 1')
                assert await page.locator('.halloween-visitor').count() == 1
                assert await page.locator('.halloween-visitor').evaluate('e => e.getBoundingClientRect().width >= 60')
                assert await page.locator('.halloween-visitor img').evaluate('e => e.complete && e.naturalWidth > 0')
                assert await page.locator('#halloween-stage').evaluate('e => getComputedStyle(e).pointerEvents === "none"')
                await page.wait_for_timeout(2200)
                await assert_controls_clear(page)
                await page.screenshot(path=str(OUT / f'{engine}-{width}-visitor.png'))
                await page.evaluate('openSettingsModal()')
                await page.wait_for_function('() => !document.querySelector(".halloween-visitor")')
                setting = page.locator('[data-setting="seasonalDecorations"]')
                await setting.uncheck()
                await page.wait_for_function('() => !document.querySelector(".halloween-hat")')
                await page.evaluate('closeOverlayModal()')
                assert await page.locator('.halloween-nav-decor, .halloween-footer-decor').count() == 0
                after = await page.locator('#daily-hero').bounding_box()
                assert before['x'] == after['x'] and before['width'] == after['width'], (before, after)
                # The decorative footer is seasonal; existing CTA placement remains stable.
                cta_after = await page.locator('#daily-hero-cta').bounding_box()
                assert cta_before == cta_after, (cta_before, cta_after)
                assert before['height'] >= after['height'], (before, after)
                await page.reload(wait_until='domcontentloaded')
                await page.wait_for_function('() => typeof openSettingsModal === "function"')
                assert await page.locator('.halloween-hat').count() == 0
                await page.evaluate('openSettingsModal()')
                await page.locator('[data-setting="seasonalDecorations"]').check()
                await page.locator('[data-setting="theme"]').select_option('dark')
                await page.evaluate('closeOverlayModal()')
                await page.wait_for_selector('.halloween-hat')
                await page.screenshot(path=str(OUT / f'{engine}-{width}-dark.png'))
                # The frame persists through real navigation, not just home.
                for action, screen in [('openAllModesScreen("solo")', 'screen-all-modes'),
                                       ('openPokedexMode()', 'screen-pokedex')]:
                    await page.evaluate(action)
                    await page.wait_for_function('(id) => document.body.dataset.screen === id', arg=screen)
                    assert await page.locator('#halloween-frame').count() == 1
                    assert await page.locator('.halloween-hat').count() == 1
                    await page.wait_for_timeout(3800)
                    await assert_controls_clear(page)
                    if width < 640:
                        await assert_mobile_ornaments(page)
                    await page.screenshot(path=str(OUT / f'{engine}-{width}-{screen}.png'))
                # Moving cameos are allowed during idle play; typing clears them immediately.
                await page.evaluate('startNormalGame()')
                await page.wait_for_function('() => document.body.dataset.screen === "screen-game"')
                await page.wait_for_timeout(6200)
                assert await page.locator('#halloween-frame').count() == 1
                await assert_controls_clear(page)
                await page.screenshot(path=str(OUT / f'{engine}-{width}-game.png'))
                await page.locator('#guess-input').fill('Pi')
                await page.wait_for_function('() => !document.querySelector(".halloween-visitor")')
                await page.locator('#guess-input').fill('')
                if width < 640:
                    # Drive the actual keyboard detector: focus plus a smaller visual viewport.
                    # Setting the CSS class alone is reset by the app's viewport synchronizer.
                    await page.evaluate('''() => {
                        document.getElementById('guess-input').focus();
                        window.__halloweenViewportHeight = Object.getOwnPropertyDescriptor(visualViewport, 'height');
                        Object.defineProperty(visualViewport, 'height', {configurable:true, get:() => innerHeight - 260});
                        visualViewport.dispatchEvent(new Event('resize'));
                    }''')
                    await page.wait_for_function('() => document.body.classList.contains("mobile-keyboard-open") && Number(getComputedStyle(document.getElementById("mobile-tabbar")).opacity) === 0')
                    await page.evaluate('''() => {
                        if (window.__halloweenViewportHeight) Object.defineProperty(visualViewport, 'height', window.__halloweenViewportHeight);
                        else delete visualViewport.height;
                        visualViewport.dispatchEvent(new Event('resize'));
                    }''')
                    await page.wait_for_function('''() => {
                        const nav = document.getElementById('mobile-tabbar');
                        return !document.body.classList.contains('mobile-keyboard-open')
                            && Number(getComputedStyle(nav).opacity) === 1
                            && !nav.getAnimations().some(animation => animation.playState === 'running');
                    }''')
                    await page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
                    await assert_mobile_ornaments(page)
                # All 24 files must actually decode, including the sixteen new PNGs.
                decoded = await page.evaluate('''async () => {
                    const old = new Set([92,93,94,198,425,607,710,778]);
                    const ids = [92,93,94,198,200,302,353,354,355,425,429,430,442,477,479,562,570,607,609,708,709,710,778,855];
                    return Promise.all(ids.map(id => new Promise(resolve => {
                        const img = new Image();
                        img.onload = () => resolve(img.naturalWidth > 0);
                        img.onerror = () => resolve(false);
                        img.src = '/img/halloween/' + id + (old.has(id) ? '.webp' : '.png');
                    })));
                }''')
                assert len(decoded) == 24 and all(decoded), decoded
                await page.emulate_media(reduced_motion='reduce')
                await page.evaluate('goToConfig()')
                await page.wait_for_timeout(7000)
                assert await page.locator('.halloween-visitor').count() == 0
                assert await page.locator('.halloween-hat').count() == 1
                await page.locator('.halloween-footer-decor').scroll_into_view_if_needed()
                await page.wait_for_timeout(300)
                assert await page.locator('.halloween-footer-pumpkins img').evaluate('e => e.complete && e.naturalWidth > 0')
                if width < 640:
                    footer_art = await page.locator('.halloween-footer-decor').bounding_box()
                    nav = await page.locator('#mobile-tabbar').bounding_box()
                    assert footer_art['y'] + footer_art['height'] <= nav['y'], (footer_art, nav)
                    await assert_mobile_ornaments(page)
                await page.screenshot(path=str(OUT / f'{engine}-{width}-footer-decor.png'))
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
