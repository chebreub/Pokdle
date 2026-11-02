"""Team Builder and Pokémon fact regressions on phone and desktop; no production data."""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'team-facts'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    log = (OUT / 'server.log').open('w')
    env = dict(os.environ, PORT='3199', DATABASE_URL='', DISCORD_CLIENT_ID='', DISCORD_CLIENT_SECRET='')
    server = subprocess.Popen(['node', 'server.js'], cwd=ROOT / 'App', env=env, stdout=log, stderr=log)
    base = 'http://127.0.0.1:3199'
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
            browser = pw.chromium.launch()
            for width, height in [(390, 844), (1366, 900)]:
                context = browser.new_context(viewport=dict(width=width, height=height), has_touch=width < 640, reduced_motion='reduce')
                page = context.new_page()
                page.goto(base, wait_until='domcontentloaded')
                page.wait_for_function('typeof tbRandomPool === "function" && POKEMON_LIST.length > 1000')
                page.wait_for_function('!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                pool = page.evaluate('async () => (await tbRandomPool({gens:[1,2,3,4,5,6,7,8,9],strong:false,noLegend:true})).map(p=>p.id)')
                assert all(pid not in pool for pid in [494,772,773,808,809,905,1014,1015,1016,1017])
                page.evaluate('''() => {
                  teamBuilderState = [6,94,248,448,82,212].map(pokemonId=>({...createTeamBuilderEmptySlot(),pokemonId}));
                  openTeamBuilderScreen(); renderTeamBuilderModule();
                }''')
                expect(page.locator('#team-builder-summary .tb-cov')).to_be_visible()
                weak = page.evaluate('tbCoverage().weak.slice(0,4)')
                verdict = page.locator('#team-builder-summary .tb-verdict').inner_text()
                for row in weak:
                    assert f'{row["type"]} ({row["weak"]} Pokémon faibles)' in verdict, verdict
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'Team overflow'
                page.locator('#team-builder-summary .tb-cov').scroll_into_view_if_needed()
                page.screenshot(path=str(OUT / f'{width}-team-weaknesses.png'))
                for slug, expected in [('meltan','Pokémon GO (2018)'), ('melmetal','Pokémon GO (2018)'), ('ogerpon','Le Masque Turquoise (2023)'), ('pechaminus','épilogue')]:
                    response = page.goto(base + '/pokemon/' + slug, wait_until='domcontentloaded')
                    assert response.status == 200, slug
                    expect(page.locator('body')).to_contain_text(expected)
                    page.screenshot(path=str(OUT / f'{width}-{slug}-layout.png'))
                    overflow = page.evaluate('''() => ({width: innerWidth, scroll: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 2).slice(0,8).map(e => ({tag:e.tagName, cls:e.className, text:e.textContent.slice(0,100), right:e.getBoundingClientRect().right}))})''')
                    assert overflow['scroll'] <= width + 2, 'SEO overflow: ' + slug + ' ' + json.dumps(overflow)
                    if slug == 'meltan':
                        page.screenshot(path=str(OUT / f'{width}-meltan.png'))
                results.append(dict(width=width, ok=True, poolSize=len(pool), weak=weak))
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
