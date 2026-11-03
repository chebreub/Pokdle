"""Actual browser controls -> actual economy routes -> isolated native PostgreSQL.

Covers phone/desktop, Chromium/WebKit, lost replies, double taps, reload/resume,
and unchanged daily rewards. The fixture is never served in production.
"""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'verified-arcade'
BASE = 'http://127.0.0.1:3198'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    log = (OUT / 'server.log').open('w')
    server = subprocess.Popen(['node', 'tools/verified_arcade_fixture.cjs'], cwd=ROOT,
                              env=os.environ.copy(), stdout=log, stderr=log)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(BASE, timeout=2).close()
                break
            except Exception:
                time.sleep(.2)
        else:
            raise RuntimeError('Isolated arcade server did not start')
        with sync_playwright() as pw:
            for engine in ('chromium', 'webkit'):
                browser = getattr(pw, engine).launch()
                for width, height in ((390, 844), (1366, 900)):
                    context = browser.new_context(viewport=dict(width=width, height=height),
                                                  is_mobile=width < 640, has_touch=width < 640,
                                                  reduced_motion='reduce', service_workers='block')
                    context.add_cookies([dict(name='qa_user', value=f'{engine}-{width}', url=BASE)])
                    page = context.new_page()
                    page.set_default_timeout(20000)
                    errors = []
                    page.on('pageerror', lambda e: errors.append(str(e)))
                    result = dict(engine=engine, width=width, ok=False)
                    try:
                        def ready():
                            page.wait_for_function('() => typeof verifiedArcadeOnline === "function" && verifiedArcadeOnline("weight") && POKEMON_BY_ID.size > 1000')
                            page.wait_for_function('() => !document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                            page.evaluate('closeOverlayModal()')
                        page.goto(BASE, wait_until='domcontentloaded')
                        ready()
                        page.evaluate('setSelectedGenerations([1]); startWeightBattle()')
                        page.wait_for_function('() => weightBattleState?.verified && !verifiedWeightLoading')
                        assert page.evaluate('secretPokemon === null')
                        first_id = page.evaluate('weightBattleState.verified.sessionId')
                        page.screenshot(path=str(OUT / f'{engine}-{width}-weight.png'))
                        # The fixture uses the real catalogue: Dracaufeu is heavier than Pikachu.
                        replies = []
                        def lose_reply(route):
                            replies.append(route.request.post_data_json)
                            response = route.fetch()
                            if len(replies) == 1:
                                assert response.ok
                                route.abort()
                            else:
                                route.fulfill(response=response)
                        page.route('**/api/arcade/answer', lose_reply)
                        page.locator('#weight-grid .versus-card').first.click()
                        page.wait_for_function('() => !weightBattleState.busy')
                        assert not page.evaluate('weightBattleState.revealed')
                        page.locator('#weight-grid .versus-card').first.click()
                        page.wait_for_function('() => weightBattleState.revealed')
                        assert replies[0] == replies[1]
                        assert page.evaluate('playerProfile.weightBattleStreak') == 1
                        assert page.evaluate('ballState.coins.balance') == 60
                        assert page.evaluate('ballState.gains.filter(g => g.source === "mode:weight").length') == 1
                        page.unroute('**/api/arcade/answer', lose_reply)
                        page.evaluate('closeOverlayModal()')
                        page.screenshot(path=str(OUT / f'{engine}-{width}-weight-result.png'))
                        page.locator('#weight-restart').click()
                        page.wait_for_function('(old) => weightBattleState.verified.sessionId !== old && !verifiedWeightLoading', arg=first_id)
                        # Rapid double taps cannot commit twice; this duel loses and resets the streak.
                        page.locator('#weight-grid .versus-card').nth(1).evaluate('(b) => { b.click(); b.click(); }')
                        page.wait_for_function('() => weightBattleState.revealed')
                        assert page.evaluate('playerProfile.weightBattleStreak') == 0
                        assert page.evaluate('ballState.coins.balance') == 60
                        page.evaluate('closeOverlayModal(); openShinyMode()')
                        page.wait_for_function('() => shinyState?.verified && shinyState.imageReady')
                        assert page.evaluate('shinyState.round.shiny === undefined')
                        assert '/api/arcade/art/' in page.locator('.shiny-art').get_attribute('src')
                        page.screenshot(path=str(OUT / f'{engine}-{width}-shiny.png'))
                        # RNG=0 in the isolated fixture -> always shiny; no production answer endpoint.
                        page.locator('#shiny-say-shiny').click()
                        page.wait_for_function('() => shinyState.phase === "reveal"')
                        assert page.evaluate('shinyState.score') == 1
                        session = page.evaluate('shinyState.verified.sessionId')
                        page.reload(wait_until='domcontentloaded')
                        ready()
                        page.evaluate('openShinyMode()')
                        page.wait_for_function('() => shinyState?.phase === "reveal"')
                        assert page.evaluate('shinyState.verified.sessionId') == session
                        assert page.evaluate('shinyState.score') == 1
                        for lives in (2, 1, 0):
                            page.locator('#shiny-next').click()
                            page.wait_for_function('() => shinyState.phase === "playing" && shinyState.imageReady')
                            page.locator('#shiny-say-normal').click()
                            page.wait_for_function('(n) => shinyState.lives === n && !shinyState.busy', arg=lives)
                        assert page.evaluate('shinyState.phase') == 'over'
                        assert page.evaluate('ballState.coins.balance') == 90  # 60 weight + 30 shiny loss
                        assert page.evaluate('ballState.gains.filter(g => g.source === "mode:shiny").length') == 1
                        page.evaluate('closeOverlayModal()')
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2')
                        page.screenshot(path=str(OUT / f'{engine}-{width}-shiny-result.png'))
                        assert not errors, errors
                        result['ok'] = True
                    except Exception as exc:
                        result['error'] = str(exc)[:2000]
                        page.screenshot(path=str(OUT / f'{engine}-{width}-failure.png'), full_page=True)
                    finally:
                        results.append(result)
                        print(json.dumps(result), flush=True)
                        context.close()
                browser.close()
    finally:
        server.terminate()
        server.wait(timeout=15)
        log.close()
        (OUT / 'report.json').write_text(json.dumps(results, indent=2))
    assert len(results) == 4 and all(r['ok'] for r in results), results


if __name__ == '__main__':
    main()
