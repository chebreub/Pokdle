"""Shop confirmation / lost-response retry at phone and desktop sizes, synthetic accounts only."""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'economy-transactions'

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, PORT='3197', DATABASE_URL='', DISCORD_CLIENT_ID='', DISCORD_CLIENT_SECRET='')
    log = (OUT / 'server.log').open('w')
    server = subprocess.Popen(['node', 'server.js'], cwd=ROOT / 'App', env=env, stdout=log, stderr=log)
    base = 'http://127.0.0.1:3197'
    results = []
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(base, timeout=2).close()
                break
            except Exception:
                time.sleep(.25)
        else:
            raise RuntimeError('QA server did not start')
        with sync_playwright() as pw:
            for engine in ('chromium', 'webkit'):
                browser = getattr(pw, engine).launch()
                for width, height in [(390, 844), (1366, 900)]:
                    context = browser.new_context(viewport=dict(width=width, height=height), reduced_motion='reduce')
                    page = context.new_page()
                    errors, purchases = [], []
                    page.on('pageerror', lambda e: errors.append(str(e)))
                    state = dict(ok=True, actionScope='test-account', authenticated=True, day='2026-11-03', resetAt='2030-11-04T00:00:00Z', cap=10, today=0, gains=[], added=[], bonus=[], giftAvailable=False,
                                 bag=dict(poke=4, great=1, ultra=0), streak=dict(days=0, inCycle=0, left=7, every=7),
                                 wild=dict(left=0, max=24, today=24, open=None, caught=0),
                                 coins=dict(enabled=True, balance=1000, today=0, played=0, recharges=0, rechargePrice=100, rechargeLeft=10, prices=dict(poke=50, great=120, ultra=300, recharge=100)))
                    def purchase(route):
                        body = route.request.post_data_json
                        purchases.append(body)
                        if len(purchases) == 1:
                            # The server accepted it; the response was lost. A repeat must use the same receipt.
                            state['coins']['balance'] -= 50
                            state['bag']['poke'] += 1
                            route.abort()
                        else:
                            assert body == purchases[0]
                            route.fulfill(json=dict(state, bought=dict(item='poke', qty=1, price=50), replayed=True))
                    page.route('**/api/balls', lambda route: route.fulfill(json=state))
                    page.route('**/api/shop/buy', purchase)
                    page.goto(base, wait_until='domcontentloaded')
                    page.wait_for_function('typeof openShop === "function" && typeof ballPaidAction === "function"')
                    page.wait_for_function('!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                    page.evaluate('(s) => { ballApply(s, {announce:false}); openShop(); }', state)
                    button = page.locator('[data-action="shopBuy"][data-args=\'["poke"]\']')
                    button.click()
                    expect(button).to_contain_text('Confirmer')
                    assert len(purchases) == 0
                    page.screenshot(path=str(OUT / f'{engine}-{width}-confirm.png'))
                    button.click()
                    page.wait_for_function('!shopBusy')
                    assert len(purchases) == 1
                    page.reload(wait_until='domcontentloaded')
                    page.wait_for_function('typeof openShop === "function"')
                    page.wait_for_function('!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                    page.evaluate('(s) => { ballApply(s, {announce:false}); openShop(); }', state)
                    button.click()
                    button.click()
                    page.wait_for_function('!shopBusy')
                    assert len(purchases) == 2
                    assert page.evaluate('ballState.coins.balance') == 950
                    assert page.evaluate('ballState.bag.poke') == 5
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2')
                    page.screenshot(path=str(OUT / f'{engine}-{width}-recovered.png'))
                    assert not errors, errors
                    results.append(dict(engine=engine, width=width, ok=True))
                    context.close()
                browser.close()
    finally:
        server.terminate()
        server.wait(timeout=15)
        log.close()
        (OUT / 'report.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results))

if __name__ == '__main__':
    main()
