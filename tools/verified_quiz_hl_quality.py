"""Built frontend + real arcade endpoints + disposable PostgreSQL, no production accounts.

All four rush clocks run concurrently for a real minute. No shortened production timer.
"""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'verified-quiz-hl'
BASE = 'http://127.0.0.1:3198'


def lost_response(calls):
    def handle(route):
        calls.append(route.request.post_data_json)
        response = route.fetch()
        if len(calls) == 1:
            assert response.ok
            route.abort()
        else:
            route.fulfill(response=response)
    return handle


def ready(page):
    page.wait_for_function('() => typeof verifiedArcadeOnline === "function" && verifiedArcadeOnline("quiz") && POKEMON_BY_ID.size > 1000')
    page.wait_for_function('() => !document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
    page.evaluate('closeOverlayModal()')


def dismiss(page):
    for selector in ('.lvc-back', '.achc'):
        item = page.locator(selector).first
        if item.count() and item.is_visible():
            item.evaluate("e=>e.dispatchEvent(new MouseEvent('click',{bubbles:false}))")


def oracle(page, mode):
    return page.request.get(BASE + '/__qa/state?mode=' + mode).json()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    results, pending, browsers = [], [], []
    log = (OUT / 'server.log').open('w')
    env = dict(os.environ, QA_ARCADE_FULL_CATALOG='1')
    server = subprocess.Popen(['node', 'tools/verified_arcade_fixture.cjs'], cwd=ROOT, env=env, stdout=log, stderr=log)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(BASE, timeout=2).close()
                break
            except Exception:
                time.sleep(.2)
        else:
            raise RuntimeError('Arcade fixture did not start')
        with sync_playwright() as pw:
            for engine in ('chromium', 'webkit'):
                browser = getattr(pw, engine).launch()
                browsers.append(browser)
                for width, height in ((390, 844), (1366, 900)):
                    context = browser.new_context(viewport=dict(width=width, height=height), is_mobile=width < 640,
                                                  has_touch=width < 640, reduced_motion='reduce', service_workers='block')
                    context.add_cookies([dict(name='qa_user', value=f'quiz-{engine}-{width}', url=BASE)])
                    page = context.new_page()
                    page.set_default_timeout(20000)
                    errors = []
                    page.on('pageerror', lambda e, errors=errors: errors.append(str(e)))
                    for selector in ('.lvc-back', '.achc'):
                        page.add_locator_handler(page.locator(selector).first,
                                                 lambda el: el.evaluate("e=>e.dispatchEvent(new MouseEvent('click',{bubbles:false}))"),
                                                 no_wait_after=True)
                    entry = dict(engine=engine, width=width, ok=False)
                    results.append(entry)
                    try:
                        page.goto(BASE, wait_until='domcontentloaded')
                        ready(page)
                        page.evaluate('startQuizGame()')
                        page.wait_for_function('() => verifiedQuiz && !verifiedQuizLoading')
                        assert page.evaluate('quizQuestions[quizCurrentIndex].answer === undefined')
                        quiz_id = page.evaluate('verifiedQuiz.server.sessionId')
                        calls = []
                        lose = lost_response(calls)
                        page.route('**/api/arcade/answer', lose)
                        choice = oracle(page, 'quiz')['question']['answer']
                        page.locator('#quiz-options button').nth(choice).click()
                        page.wait_for_function('() => !verifiedQuiz.busy')
                        assert page.evaluate('quizScore') == 0
                        page.locator('#quiz-options button').nth(choice).evaluate('(b)=>{b.click();b.click();}')
                        page.wait_for_function('() => quizAnswered && !verifiedQuiz.busy')
                        assert calls[0] == calls[1]
                        assert page.evaluate('quizScore') == 1
                        page.unroute('**/api/arcade/answer', lose)
                        page.screenshot(path=str(OUT / f'{engine}-{width}-quiz-answer.png'))
                        for i in range(1, 15):
                            page.locator('#quiz-next-btn').click()
                            page.wait_for_function('(i)=>verifiedQuiz.server.round===i && !verifiedQuiz.busy', arg=i)
                            choice = oracle(page, 'quiz')['question']['answer']
                            page.locator('#quiz-options button').nth(choice).click()
                            page.wait_for_function('()=>quizAnswered && !verifiedQuiz.busy')
                            if i == 7:
                                page.reload(wait_until='domcontentloaded')
                                ready(page)
                                page.evaluate('startQuizGame()')
                                page.wait_for_function('()=>verifiedQuiz?.server.round===7 && quizAnswered')
                                assert page.evaluate('verifiedQuiz.server.sessionId') == quiz_id
                                assert page.evaluate('quizScore') == 8
                        assert page.evaluate('ballState.coins.balance') == 90
                        page.locator('#quiz-next-btn').click()
                        page.wait_for_function('()=>gameOver && quizSessionLogged')
                        assert page.locator('#quiz-end-score').inner_text() == '15 / 15'
                        assert page.locator('#quiz-history .quiz-history-item').count() == 15
                        dismiss(page)
                        page.screenshot(path=str(OUT / f'{engine}-{width}-quiz-result.png'))
                        page.evaluate('closeOverlayModal();openHigherLowerMode();startHigherLowerMode("infinite")')
                        page.wait_for_function('()=>isVerifiedHL() && higherLowerState.phase==="playing" && !verifiedHLLoading')
                        assert page.evaluate('higherLowerState.right.statValue === undefined')
                        q = oracle(page, 'higher-lower')['question']
                        good = 'higher' if q['rightValue'] >= q['leftValue'] else 'lower'
                        page.locator('.higher-lower-btn-' + good).click()
                        page.wait_for_function('()=>higherLowerState.score===1 && higherLowerState.phase==="playing" && higherLowerState.verified.round===1')
                        q = oracle(page, 'higher-lower')['question']
                        bad = 'lower' if q['rightValue'] > q['leftValue'] else 'higher'
                        page.locator('.higher-lower-btn-' + bad).click()
                        page.wait_for_function('()=>higherLowerState.phase==="gameover"')
                        assert page.evaluate('ballState.coins.balance') == 120
                        dismiss(page)
                        page.screenshot(path=str(OUT / f'{engine}-{width}-infinite-result.png'))
                        page.evaluate('restartHigherLowerGame();startHigherLowerMode("rush60")')
                        page.wait_for_function('()=>isVerifiedHL() && higherLowerState.mode==="rush60" && !verifiedHLLoading')
                        deadline = page.evaluate('higherLowerState.verified.endsAt')
                        early = page.evaluate('()=>verifiedArcadeRequest("finish",{...verifiedHLBody(higherLowerState),endsAt:0,score:999})')
                        assert early['error'] == 'round_wait'
                        # Reopening resumes the same server deadline, including after a full reload.
                        page.reload(wait_until='domcontentloaded')
                        ready(page)
                        page.evaluate('openHigherLowerMode();startHigherLowerMode("rush60")')
                        page.wait_for_function('()=>isVerifiedHL() && !verifiedHLLoading')
                        assert page.evaluate('higherLowerState.verified.endsAt') == deadline
                        assert page.evaluate('higherLowerState.rushLeftMs') < 60000
                        finish_calls = []
                        page.route('**/api/arcade/finish', lost_response(finish_calls))
                        page.screenshot(path=str(OUT / f'{engine}-{width}-rush.png'))
                        pending.append((page, context, entry, errors, finish_calls))
                    except Exception as exc:
                        entry['error'] = str(exc)[:2000]
                        page.screenshot(path=str(OUT / f'{engine}-{width}-failure.png'), full_page=True)
                        context.close()
                        print(json.dumps(entry), flush=True)
            # The four real 60-second clocks have been running while other cases start.
            for page, context, entry, errors, calls in pending:
                try:
                    page.wait_for_function('()=>higherLowerState.rushLeftMs===0 && !higherLowerState.busy', timeout=75000)
                    assert len(calls) == 1
                    page.get_by_role('button', name='Réessayer', exact=True).click()
                    page.wait_for_function('()=>higherLowerState.phase==="gameover"')
                    assert len(calls) == 2 and calls[0] == calls[1]
                    assert page.evaluate('ballState.coins.balance') == 120, 'HL formats share one daily reward'
                    assert page.evaluate('ballState.gains.filter(g=>g.source==="mode:higherlower").length') == 1
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
                    page.screenshot(path=str(OUT / f'{entry["engine"]}-{entry["width"]}-rush-result.png'))
                    assert not errors, errors
                    entry['ok'] = True
                except Exception as exc:
                    entry['error'] = str(exc)[:2000]
                    page.screenshot(path=str(OUT / f'{entry["engine"]}-{entry["width"]}-failure.png'), full_page=True)
                finally:
                    print(json.dumps(entry), flush=True)
                    context.close()
            for browser in browsers:
                browser.close()
    finally:
        server.terminate()
        server.wait(timeout=15)
        log.close()
        (OUT / 'report.json').write_text(json.dumps(results, indent=2))
    assert len(results) == 4 and all(x['ok'] for x in results), results


if __name__ == '__main__':
    main()
