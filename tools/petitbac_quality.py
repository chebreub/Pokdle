"""Petit Bac QA: two real browsers play a Party Room round (setup, private sheets, STOP,
vote, results, next letter), then the solo mode against the clock. No database needed."""
import json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]; OUT = ROOT / 'quality-artifacts' / 'petitbac'; OUT.mkdir(parents=True, exist_ok=True)
PORT = '3195'; BASE = f'http://127.0.0.1:{PORT}/'
ROUND = 'partyRoomState.room.round'


def wait(page, expr, timeout=12000):
    page.wait_for_function('() => (' + expr + ')', timeout=timeout)


def expect(ok, message):
    if not ok: raise AssertionError(message)


def play(browser, engine):
    a_ctx = browser.new_context(viewport={'width': 1366, 'height': 900})
    b_ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    a, b = a_ctx.new_page(), b_ctx.new_page()
    errors = []
    try:
        for page in (a, b):
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.set_default_timeout(10000)
            page.goto(BASE, wait_until='domcontentloaded')
            wait(page, "typeof openPartyRoomMode === 'function' && typeof renderPartyPetitBac === 'function' && POKEMON_LIST.length > 1000")
            page.evaluate('openPartyRoomMode()')
        a.fill('#party-nickname', 'Sacha'); a.evaluate('partyCreateRoom()'); wait(a, 'partyRoomState.code')
        b.fill('#party-nickname', 'Ondine'); b.fill('#party-join-code', a.evaluate('partyRoomState.code')); b.evaluate('partyJoinRoom()')
        wait(a, 'partyRoomState.room && partyRoomState.room.players.length === 2')

        a.locator('#party-mode-petitbac').click()
        # Each screen updates on its own message: wait for both before looking.
        for page in (a, b): wait(page, "partyRoomState.room.gameMode === 'petitbac' && document.querySelector('#petit-bac-setup:not(.hidden) button')")
        expect(a.locator('#petit-bac-setup').is_visible(), 'host setting for free columns missing')
        expect(b.locator('#petit-bac-setup button').first.is_disabled(), 'a guest can change the host setting')
        expect(a.evaluate('partyRoomState.room.totalRounds') == 3, 'a Petit Bac game is three letters')
        a.locator('#petit-bac-setup button', has_text='au vote').click()
        for page in (a, b): wait(page, 'partyRoomState.room.bacFree === true')

        a.evaluate('partyStartGame()')
        for page in (a, b): wait(page, "partyRoomState.room.status === 'playing' && " + ROUND + ".phase === 'write' && document.querySelectorAll('#party-bac-sheet [data-bac-index]').length === 6")
        letter = a.evaluate(ROUND + '.letter'); cats = a.evaluate(ROUND + '.categories')
        expect(sum(1 for c in cats if c['family'] == 'free') == 2, 'two voted columns expected')
        expect(('Lettre ' + letter) in a.locator('#party-round-mode').inner_text(), 'round title shows the letter')
        expect(a.locator('#party-round-input').is_hidden(), 'the generic guess field must stay hidden')
        names = a.evaluate("petitBacNames('" + letter + "')")
        expect(len(names) >= 8, 'too few names for the drawn letter')
        for i, c in enumerate(cats):
            a.locator("#party-bac-sheet [data-bac-index='%d']" % i).fill((letter + 'uper truc') if c['family'] == 'free' else names[i])
        rival = [names[-1], names[-2], names[-3]]
        for i in range(3): b.locator("#party-bac-sheet [data-bac-index='%d']" % i).fill(rival[i])
        b.locator("#party-bac-sheet [data-bac-index='0']").press('Enter')
        expect(b.evaluate('document.activeElement && document.activeElement.dataset.bacIndex') == '1', 'Enter should move to the next column')
        wait(a, "partyRoomState.room.round.progress.some(p => p.filled === 3) && document.getElementById('party-players').innerText.includes('3 / 6')", 8000)
        expect(rival[0] not in a.evaluate('JSON.stringify(partyRoomState.room)'), 'a rival answer leaked while writing')
        expect(b.locator('#party-bac-stop').is_disabled(), 'STOP needs a full sheet')
        a.screenshot(path=str(OUT / f'{engine}-write-desktop.png'))
        b.screenshot(path=str(OUT / f'{engine}-write-mobile.png'), full_page=True)

        a.locator('#party-bac-stop').click()
        for page in (a, b): wait(page, ROUND + ".phase === 'stopping' && (document.getElementById('party-bac-banner')?.textContent || '').includes('STOP')")
        b.locator("#party-bac-sheet [data-bac-index='3']").fill(names[-4])
        for page in (a, b): wait(page, ROUND + ".phase === 'vote'", 16000)
        wait(b, "document.querySelectorAll('#party-bac-ballot .bac-vote-buttons').length >= 1")
        wait(a, "(document.getElementById('party-bac-ballot')?.innerText || '').includes('ta réponse')")
        b.locator('#party-bac-ballot .bac-vote-buttons button', has_text='✗').first.click()
        wait(b, 'partyRoomState.room.round.ballot.some(e => e.myVote === false)')
        b.screenshot(path=str(OUT / f'{engine}-vote-mobile.png'), full_page=True)
        a.locator('#party-bac-done').click(); b.locator('#party-bac-done').click()
        for page in (a, b): wait(page, "partyRoomState.room.status === 'finished' && " + ROUND + ".phase === 'done' && document.querySelectorAll('.bac-results tbody tr').length === 2")
        expect(b.locator('.bac-results tbody tr').count() == 2, 'one result row per player')
        expect(a.evaluate("partyRoomState.room.round.results.find(row => row.nickname === 'Sacha').answers.some(x => x.reason === 'vote')"), 'the rejected answer still counts')
        expect(not a.locator('#party-petitbac').evaluate("el => el.classList.contains('is-stopping')"), 'the STOP ring stays after the round')
        expect(b.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'results overflow the phone screen')
        b.screenshot(path=str(OUT / f'{engine}-results-mobile.png'), full_page=True)

        a.evaluate('partyNextRound()')
        for page in (a, b): wait(page, "partyRoomState.room.status === 'playing' && " + ROUND + ".phase === 'write' && " + ROUND + ".letter !== '" + letter + "'")
        expect(a.evaluate("[...document.querySelectorAll('#party-bac-sheet [data-bac-index]')].every(i => !i.value)"), 'the new sheet starts empty')

        b.evaluate('openPetitBacMode()'); wait(b, "document.querySelector('[data-action=startPetitBacRound]')")
        b.locator('[data-action=startPetitBacRound]').click(); wait(b, "petitBacState && petitBacState.phase === 'playing'")
        solo_letter = b.evaluate('petitBacState.letter')
        expect(b.locator('#petitbac-sheet input').count() == 6, 'solo sheet needs six columns')
        b.locator('#petitbac-sheet input').first.fill(b.evaluate("petitBacNames('" + solo_letter + "')[0]"))
        b.locator('.bac-submit').click(); wait(b, "petitBacState.phase === 'finished'")
        expect(b.locator('.bac-review li').count() == 6, 'solo review needs six rows')
        expect(b.locator('#screen-petit-bac .dedicated-toolbar').count() == 1, 'solo screen lost its game frame')
        expect(b.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'solo overflows the phone screen')
        b.screenshot(path=str(OUT / f'{engine}-solo-mobile.png'), full_page=True)
        expect(not errors, errors)
        return dict(engine=engine, ok=True)
    except Exception as e:
        for name, page in (('desktop', a), ('mobile', b)):
            try: page.screenshot(path=str(OUT / f'{engine}-{name}-failure.png'), full_page=True)
            except Exception: pass
        return dict(engine=engine, ok=False, error=str(e)[:600], pageErrors=errors)
    finally:
        a_ctx.close(); b_ctx.close()


def run():
    reports = []
    with sync_playwright() as pw:
        for engine in ['chromium', 'webkit']:
            browser = getattr(pw, engine).launch()
            report = play(browser, engine)
            if not report['ok']:
                retry = play(browser, engine); print('PETITBAC-RETRY', json.dumps(report, ensure_ascii=False)); retry['retried'] = True; report = retry
            reports.append(report); browser.close()
    (OUT / 'report.json').write_text(json.dumps(reports, indent=2, ensure_ascii=False))
    print('PETITBAC', json.dumps(reports, ensure_ascii=False))
    assert all(r['ok'] for r in reports)


if __name__ == '__main__':
    with (OUT / 'server.log').open('w') as log:
        env = dict(os.environ, PORT=PORT); env.pop('DATABASE_URL', None); env.pop('PGDATABASE', None)
        server = subprocess.Popen(['node', 'server.js'], cwd=ROOT / 'App', env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            for _ in range(80):
                try: urllib.request.urlopen(BASE, timeout=2).close(); break
                except Exception:
                    if server.poll() is not None: raise RuntimeError('QA server exited')
                    time.sleep(.25)
            else: raise RuntimeError('QA server unavailable')
            run()
        finally:
            server.terminate()
            try: server.wait(timeout=5)
            except subprocess.TimeoutExpired: server.kill()
