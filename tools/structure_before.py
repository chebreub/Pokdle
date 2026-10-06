"""Capture the pre-structure main revision at the exact requested viewports.

Runs only in browser CI. The temporary checkout has no account/database access.
"""
import argparse, io, os, subprocess, tarfile, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'a0e18dc32037cd62e83d7cd12230326ac4a544ca'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='before-artifacts')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    out = (repo / args.output).resolve(); out.mkdir(parents=True, exist_ok=True)
    subprocess.run(['git', 'fetch', '--depth=1', 'origin', BASE], cwd=repo, check=True)
    archive = subprocess.check_output(['git', 'archive', BASE, 'App'], cwd=repo)
    with tempfile.TemporaryDirectory(prefix='pokedle-before-') as temp:
        checkout = Path(temp)
        with tarfile.open(fileobj=io.BytesIO(archive)) as source:
            source.extractall(checkout, filter='data')
        app = checkout / 'App'
        (app / 'node_modules').symlink_to(repo / 'App/node_modules', target_is_directory=True)
        subprocess.run(['node', 'build.mjs'], cwd=app, check=True)
        env = dict(os.environ, PORT='3134')
        for key in ['DATABASE_URL', 'SESSION_SECRET', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET']:
            env.pop(key, None)
        with open(out / 'server.log', 'w') as log:
            server = subprocess.Popen(['node', 'server.js'], cwd=app, env=env, stdout=log, stderr=log)
            try:
                for _ in range(80):
                    try:
                        urllib.request.urlopen('http://127.0.0.1:3134/', timeout=1).close(); break
                    except Exception:
                        time.sleep(.1)
                else:
                    raise RuntimeError('Baseline server did not start')
                with sync_playwright() as pw:
                    browser = pw.chromium.launch()
                    for width, height in [(1366,768),(390,844)]:
                        context = browser.new_context(viewport={'width':width,'height':height}, reduced_motion='reduce')
                        page = context.new_page(); page.set_default_timeout(15000)
                        page.goto('http://127.0.0.1:3134/', wait_until='domcontentloaded')
                        page.wait_for_function('() => typeof startDailyGame === "function" && typeof POKEMON_LIST !== "undefined"')
                        page.wait_for_function('() => !document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                        page.evaluate('closeOverlayModal()')
                        def capture(name):
                            page.screenshot(path=str(out / f'{width}-before-{name}.jpg'), quality=85, animations='disabled')
                        capture('home')
                        page.locator('.home-discovery').screenshot(path=str(out / f'{width}-before-catalog.jpg'), quality=85, animations='disabled')
                        page.evaluate('startDailyGame();closeOverlayModal()')
                        page.locator('#screen-game').wait_for(state='visible')
                        guess = page.evaluate('secretPokemon.name === "Bulbizarre" ? "Salamèche" : "Bulbizarre"')
                        page.locator('#guess-input').fill(guess); page.locator('#btn-submit').click()
                        page.evaluate('scrollTo(0,0)'); capture('daily')
                        page.evaluate('document.body.classList.add("theme-dark")'); capture('daily-dark')
                        page.evaluate('document.body.classList.remove("theme-dark")')
                        page.locator('#guess-input').fill(page.evaluate('secretPokemon.name')); page.locator('#btn-submit').click()
                        page.locator('#win-box').wait_for(state='visible')
                        page.wait_for_timeout(400)
                        page.evaluate('typeof closePokedexRegistration === "function" && closePokedexRegistration()')
                        page.locator('#win-box').scroll_into_view_if_needed(); capture('result')
                        page.evaluate('goToConfig();startCryGame();closeOverlayModal();scrollTo(0,0)')
                        page.locator('#cry-box').wait_for(state='visible'); capture('cry')
                        context.close()
                    browser.close()
                (out / 'revision.txt').write_text(BASE+'\n1366×768 and 390×844. No production account or database.\n')
            finally:
                server.terminate()
                try: server.wait(timeout=5)
                except subprocess.TimeoutExpired: server.kill()

if __name__ == '__main__':
    main()
