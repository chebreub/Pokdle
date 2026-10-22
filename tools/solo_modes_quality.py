"""Final solo-mode QA using local guest sessions; no Render or production credentials.

Checks actual controls, answerability, hints and small-screen rendering for the
four polished modes on Chromium/WebKit (desktop + touch-sized phone).
"""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "quality-artifacts" / "solo-mode-recipe"
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://127.0.0.1:3195/"


def wait(page, expr):
    page.wait_for_function("() => (" + expr + ")", timeout=14000)


def screen(page, name):
    page.locator("#" + name).wait_for(state="visible")
    page.wait_for_function(
        "(id) => { const el = document.getElementById(id); return el && getComputedStyle(el).display !== 'none'; }",
        arg=name
    )
    overflow = page.evaluate("document.documentElement.scrollWidth - innerWidth")
    assert overflow <= 2, f"{name}: horizontal overflow {overflow}px"


def submit_name(page, name):
    field = page.locator("#guess-input")
    field.fill(name)
    field.press("Enter")
    wait(page, "gameOver === true")


def run():
    cases = []
    with sync_playwright() as playwright:
        for engine in ("chromium", "webkit"):
            browser = getattr(playwright, engine).launch()
            for width, height in ((390, 844), (1366, 768)):
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    is_mobile=width < 640, has_touch=width < 640,
                    reduced_motion="reduce",
                )
                page = context.new_page()
                page.set_default_timeout(14000)
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                try:
                    page.goto(URL, wait_until="domcontentloaded")
                    wait(page, 'typeof startEvolutionChainGame === "function" && typeof startPokedexOrderGame === "function" && POKEMON_LIST.length > 1000')
                    wait(page, '!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                    page.evaluate('''() => {
                        closeOverlayModal();
                        setSelectedGenerations([1]);
                    }''')

                    def execute(case_name, func):
                        entry = {"engine": engine, "width": width, "case": case_name, "ok": False}
                        try:
                            func()
                            entry["ok"] = True
                        except Exception as exc:
                            entry["error"] = str(exc)[:1600]
                            try:
                                page.screenshot(path=str(OUT / f"{engine}-{width}-{case_name}-failure.png"),
                                                full_page=True, animations="disabled")
                            except Exception:
                                pass
                        cases.append(entry)
                        print("SOLO_MODE_QA " + json.dumps(entry, ensure_ascii=False), flush=True)

                    def quiz_result():
                        page.evaluate("goToConfig();startQuizGame();closeOverlayModal()")
                        screen(page, "screen-game")
                        page.locator("#quiz-question").wait_for(state="visible")
                        page.evaluate("""() => {
                            playerProfile.quizHighScore=12;
                            quizScore=11;
                            quizCurrentIndex=quizQuestions.length;
                            quizHistory=quizQuestions.map((q,i)=>({ok:i<11,text:'Test'}));
                            renderQuizQuestion();
                        }""")
                        card=page.locator("#quiz-end-card")
                        assert card.is_visible(), "Missing solo quiz summary"
                        assert "11 / 15" in page.locator("#quiz-end-score").inner_text()
                        assert "73 %" in page.locator("#quiz-end-accuracy").inner_text()
                        assert "+85 XP" in page.locator("#quiz-end-xp").inner_text()
                        assert not page.locator("#quiz-next-btn").is_visible(), "Duplicate replay button"
                        assert page.evaluate("document.activeElement?.id") == "quiz-end-card"
                        page.screenshot(path=str(OUT / f"{engine}-{width}-quiz-result.png"),animations="disabled")
                        if width < 640:
                            rect=card.bounding_box();nav=page.locator("#mobile-tabbar").bounding_box()
                            assert rect and nav and rect["y"]>=0 and rect["y"]+rect["height"]<=nav["y"]-4,(rect,nav)
                        previous_xp=page.evaluate("playerProfile.xp")
                        page.evaluate("renderQuizQuestion()")
                        assert page.evaluate("playerProfile.xp")==previous_xp, "Results rewarded XP twice"
                        page.evaluate("""() => {
                            partySession={currentModeKey:'quiz',completed:true,roundResolved:true};
                            renderQuizQuestion();
                        }""")
                        assert not card.is_visible(), "Completed Party exposes solo summary"
                        page.evaluate("nextQuizQuestion()")
                        assert page.evaluate("gameOver"), "Party restarted via solo replay"
                        page.evaluate("partySession=null")
                        page.evaluate("renderQuizQuestion()")
                        replay=page.locator("#quiz-result-replay")
                        if width < 640: replay.tap()
                        else: replay.click()
                        assert not card.is_visible() and page.evaluate("!gameOver && quizScore===0")
                        page.evaluate("""() => {
                            quizScore=0;quizCurrentIndex=quizQuestions.length;
                            quizHistory=quizQuestions.map(q=>({ok:false,text:'Test'}));
                            renderQuizQuestion();
                        }""")
                        assert card.is_visible() and page.locator("#quiz-end-score").inner_text().strip()=="0 / 15"
                        catalog=page.locator("#quiz-result-catalog")
                        if width < 640: catalog.tap()
                        else: catalog.click()
                        screen(page,"screen-all-modes")

                    def weight():
                        page.evaluate("goToConfig();startWeightBattle();closeOverlayModal()")
                        screen(page, "screen-game")
                        page.locator("#weight-box").wait_for(state="visible")
                        assert page.locator("#weight-grid .versus-card").count() == 2
                        assert not page.locator("#weight-result-actions").is_visible(), "Replay visible during the duel"
                        wrong = page.evaluate("weightBattleState.left.id === secretPokemon.id ? 1 : 0")
                        wrong_card = page.locator("#weight-grid .versus-card").nth(wrong)
                        if width < 640:
                            wrong_card.tap()
                        else:
                            wrong_card.click()
                        assert page.evaluate("weightBattleState.revealed && gameOver"), "Duel did not finish"
                        assert page.locator("#weight-result-actions").is_visible(), "Missing replay beside the answer"
                        assert "était le plus lourd" in page.locator("#weight-result-detail").inner_text()
                        assert page.evaluate("document.activeElement?.id") == "weight-result-actions", "Focus stayed on disabled card"
                        if width < 640:
                            actions = page.locator("#weight-result-actions").bounding_box()
                            nav = page.locator("#mobile-tabbar").bounding_box()
                            assert actions and nav and actions["y"] >= 0, (actions, nav)
                            assert actions["y"] + actions["height"] <= nav["y"] - 4, "Replay hidden behind mobile tabbar"
                        page.screenshot(path=str(OUT / f"{engine}-{width}-weight-result.png"), animations="disabled")
                        replay = page.locator("#weight-restart")
                        if width < 640:
                            replay.tap()
                        else:
                            replay.click()
                        assert not page.locator("#weight-result-actions").is_visible(), "Old result leaked into new duel"
                        assert page.evaluate("!weightBattleState.revealed && !gameOver"), "Duel was not reset"
                        assert page.evaluate("document.activeElement?.id") == "weight-status", "Focus left on hidden replay"
                        assert page.locator("#weight-grid .versus-card:not([disabled])").count() == 2
                        correct = page.evaluate("weightBattleState.left.id === secretPokemon.id ? 0 : 1")
                        target = page.locator("#weight-grid .versus-card").nth(correct)
                        if width < 640:
                            target.tap()
                        else:
                            target.click()
                        assert "Bien vu" in page.locator("#weight-result-detail").inner_text(), "Victory result not shown"
                        # A completed Party round must not expose the solo replay.
                        page.evaluate("""() => {
                            partySession = {currentModeKey:'weight',completed:true,roundResolved:true,
                                currentRound:1,maxRounds:1,score:0,wins:0,losses:1};
                            renderWeightBattlePanel();
                        }""")
                        assert not page.locator("#weight-result-actions").is_visible(), "Solo actions visible in completed Party"
                        assert not page.locator("#weight-restart").is_visible(), "Party can start a solo duel"
                        page.evaluate("replayWeightBattle()")
                        assert page.evaluate("weightBattleState.revealed && gameOver"), "Party replay guard failed"
                        page.evaluate("partySession = null;renderWeightBattlePanel()")
                        assert page.locator("#weight-result-actions").is_visible(), "Solo replay not restored"
                        catalog = page.locator("#weight-result-catalog")
                        if width < 640:
                            catalog.tap()
                        else:
                            catalog.click()
                        screen(page, "screen-all-modes")

                    def evolution():
                        page.evaluate("goToConfig();startEvolutionChainGame();closeOverlayModal()")
                        screen(page, "screen-game")
                        page.locator("#evolution-box").wait_for(state="visible")
                        chain = page.evaluate("""() => ({
                            ids:evolutionChainState.chain.map(p=>p.id),
                            names:evolutionChainState.chain.map(p=>p.name),
                            secret:secretPokemon.id,
                            valid:VERIFIED_EVOLUTION_FAMILY_STARTS.has(evolutionChainState.chain[0].id)
                        })""")
                        assert chain["valid"], chain
                        assert chain["ids"][1] == chain["secret"]
                        assert chain["ids"][0] + 1 == chain["ids"][1] == chain["ids"][2] - 1, chain
                        visible = page.locator("#evolution-chain").inner_text()
                        assert chain["names"][0] in visible and chain["names"][2] in visible, visible
                        assert "Manquant" in visible
                        page.screenshot(path=str(OUT / f"{engine}-{width}-evolution.png"), animations="disabled")
                        submit_name(page, chain["names"][1])
                        assert page.evaluate("gameMode") == "evolution", "Mode unexpectedly switched"
                        assert page.locator("#win-box").is_visible(), "Winning Evolution lacks a result"
                        celebration = page.locator('#pokedex-registration-layer:not(.hidden) [data-action="closePokedexRegistration"]')
                        if celebration.is_visible():
                            celebration.click()
                        # Completed Party must not restart via a solo button.
                        page.evaluate("""() => {
                            partySession={currentModeKey:'evolution',completed:true,roundResolved:true};
                            restartCurrentMode();
                        }""")
                        assert page.evaluate("gameOver && secretPokemon.id") == chain["secret"], "Finished Party replayed solo"
                        page.evaluate("partySession=null")
                        button = page.locator("#btn-restart")
                        if width < 640:
                            button.tap()
                        else:
                            button.click()
                        assert page.evaluate("gameMode==='evolution' && !gameOver && attempts===0")
                        assert not page.locator("#win-box").is_visible(), "Old Evolution result remains after replay"
                        assert page.locator("#evolution-box").is_visible(), "New chain not visible"
                        assert page.evaluate("secretPokemon.id") != chain["secret"], "Replay reused the same chain"
                        assert page.evaluate("document.activeElement?.id") == ("evolution-box" if width < 640 else "guess-input"), "Replay focus incorrect"
                        assert page.locator("#evolution-chain").inner_text().count("Manquant") == 1
                        if width < 640:
                            rect = page.locator("#evolution-box").bounding_box()
                            nav = page.locator("#mobile-tabbar").bounding_box()
                            assert rect and nav and rect["y"] >= 0 and rect["y"] + rect["height"] <= nav["y"] - 4, (rect,nav)
                            assert page.evaluate("document.activeElement?.tagName") != "INPUT", "Mobile keyboard opened after replay"
                        page.screenshot(path=str(OUT / f"{engine}-{width}-evolution-replay.png"), animations="disabled")

                    def order():
                        page.evaluate("goToConfig();startPokedexOrderGame();closeOverlayModal()")
                        screen(page, "screen-game")
                        page.locator("#order-box").wait_for(state="visible")
                        puzzle = page.evaluate("""() => ({
                            lower:pokedexOrderState.lower.id, middle:pokedexOrderState.middle.id,
                            upper:pokedexOrderState.upper.id, name:pokedexOrderState.middle.name,
                            secret:secretPokemon.id
                        })""")
                        assert puzzle["lower"] + 1 == puzzle["middle"] == puzzle["upper"] - 1, puzzle
                        assert puzzle["middle"] == puzzle["secret"], puzzle
                        low = page.locator("#order-lower-label").inner_text()
                        high = page.locator("#order-upper-label").inner_text()
                        assert str(puzzle["lower"]).zfill(3) in low and str(puzzle["upper"]).zfill(3) in high
                        page.screenshot(path=str(OUT / f"{engine}-{width}-pokedex-order.png"), animations="disabled")
                        submit_name(page, puzzle["name"])
                        assert page.evaluate("gameMode") == "order"
                        assert page.locator("#win-box").is_visible(), "Winning Ordre lacks a result"
                        celebration = page.locator('#pokedex-registration-layer:not(.hidden) [data-action="closePokedexRegistration"]')
                        if celebration.is_visible():
                            celebration.click()
                        button = page.locator("#btn-restart")
                        if width < 640:
                            button.tap()
                        else:
                            button.click()
                        assert page.evaluate("gameMode==='order' && !gameOver && attempts===0")
                        assert not page.locator("#win-box").is_visible(), "Old Ordre result remains"
                        assert page.evaluate("pokedexOrderState.middle.id") != puzzle["middle"], "Replay reused the old answer"
                        assert page.evaluate("document.activeElement?.id") == ("order-box" if width < 640 else "guess-input"), "Replay focus incorrect"
                        assert page.locator("#order-box").is_visible(), "Ordre clues not visible"
                        if width < 640:
                            rect = page.locator("#order-box").bounding_box()
                            nav = page.locator("#mobile-tabbar").bounding_box()
                            assert rect and nav and rect["y"] >= 0 and rect["y"] + rect["height"] <= nav["y"] - 4, (rect,nav)
                            assert page.evaluate("document.activeElement?.tagName") != "INPUT", "Mobile keyboard opened after replay"
                        # The same continuation must work after a defeat/abandonment.
                        page.evaluate("surrenderGame()")
                        assert page.locator("#win-box").is_visible() and page.evaluate("gameOver")
                        if width < 640:
                            button.tap()
                        else:
                            button.click()
                        assert page.evaluate("gameMode==='order' && !gameOver && attempts===0")
                        assert not page.locator("#win-box").is_visible()
                        assert page.evaluate("document.activeElement?.id") == ("order-box" if width < 640 else "guess-input")
                        page.screenshot(path=str(OUT / f"{engine}-{width}-order-replay.png"), animations="disabled")

                    def odd():
                        page.evaluate("goToConfig();openOddOneOutMode()")
                        screen(page, "screen-odd-one-out")
                        # Change the real UI control, not the global JS state.
                        selector = page.locator("#odd-difficulty-select")
                        selector.select_option("easy")
                        assert page.locator("#odd-grid .odd-card").count() == 6
                        assert page.evaluate("oddOneOutState.rule") == "letter", "Easy mode must use first letters"
                        assert "première lettre" in page.locator("#odd-status").inner_text()
                        first = page.evaluate("""() => ({
                            idx:oddOneOutState.cards.findIndex(p=>p.id===oddOneOutState.oddId),
                            count:oddOneOutState.count
                        })""")
                        assert first["idx"] >= 0
                        page.screenshot(path=str(OUT / f"{engine}-{width}-odd-easy.png"), animations="disabled")
                        answer = page.locator("#odd-grid .odd-card").nth(first["idx"])
                        if width < 640:
                            answer.tap()
                        else:
                            answer.click()
                        assert page.locator("#odd-explanation-box").is_visible(), "No explanation after answer"
                        assert page.evaluate("oddOneOutState.revealed && gameOver"), "Answer did not end the round"
                        assert page.locator("#odd-status").inner_text().startswith("Bonne réponse")
                        assert page.locator("#odd-result-actions").is_visible(), "Missing continuation beside the result"
                        assert page.evaluate("document.activeElement?.id") == "odd-explanation-box", "Result did not receive keyboard focus"
                        if width < 640:
                            actions = page.locator("#odd-result-actions").bounding_box()
                            nav = page.locator("#mobile-tabbar").bounding_box()
                            assert actions and nav and actions["y"] >= 0, (actions, nav)
                            assert actions["y"] + actions["height"] <= nav["y"] - 4, "Replay hidden behind mobile tabbar"
                        page.screenshot(path=str(OUT / f"{engine}-{width}-odd-result.png"), animations="disabled")
                        btn = page.locator("#odd-replay-result")
                        if width < 640:
                            btn.tap()
                        else:
                            btn.click()
                        assert not page.locator("#odd-explanation-box").is_visible(), "Old answer leaked into new round"
                        assert not page.locator("#odd-result-actions").is_visible(), "Result actions leaked into the new round"
                        assert page.evaluate("!oddOneOutState.revealed && !gameOver"), "Round state was not reset"
                        assert page.evaluate("document.activeElement?.id") == "odd-status", "Focus was left on a hidden replay button"
                        assert page.evaluate("oddOneOutState.count") > first["count"]
                        selector.select_option("medium")
                        assert page.locator("#odd-grid .odd-card").count() == 6
                        assert "Difficulté : Moyen" in page.locator("#odd-puzzle-difficulty").inner_text()
                        selector.select_option("hard")
                        assert "Difficulté : Difficile" in page.locator("#odd-puzzle-difficulty").inner_text()
                        assert page.locator("#odd-grid .odd-card").count() == 6
                        assert "Trouve toi-même" in page.locator("#odd-status").inner_text()
                        unique = page.evaluate("""() => oddPossibleOutliers(oddOneOutState.cards,
                            ['type','generation','letter','color','habitat','stage'])""")
                        assert unique == [page.evaluate("oddOneOutState.oddId")], unique
                        page.screenshot(path=str(OUT / f"{engine}-{width}-odd-hard.png"), animations="disabled")
                        page.evaluate("submitOddOneOutChoice(oddOneOutState.oddId)")
                        assert page.locator("#odd-result-actions").is_visible(), "Missing solo catalog continuation"
                        # A completed Party round must never show a solo replay,
                        # even once isPartySessionActive() has become false.
                        page.evaluate("""() => {
                            partySession = {currentModeKey:'odd',completed:true,roundResolved:true};
                            renderOddOneOutPuzzle();
                        }""")
                        assert not page.locator("#odd-result-actions").is_visible(), "Solo actions leaked into the completed Party"
                        assert not page.locator("#odd-new-puzzle-btn").is_visible(), "Party could start an unauthorized solo puzzle"
                        page.evaluate("""() => { partySession = null;renderOddOneOutPuzzle(); }""")
                        assert page.locator("#odd-result-actions").is_visible(), "Solo result was not restored"
                        catalog = page.locator("#odd-result-catalog")
                        if width < 640:
                            catalog.tap()
                        else:
                            catalog.click()
                        screen(page, "screen-all-modes")

                    def mystery():
                        # Deterministic battle stats prevent CI from depending on a public API.
                        page.evaluate("""() => {
                            goToConfig();
                            window.fetchBattleStats = async () => ({
                                hp:71,attack:52,defense:63,spAttack:74,spDefense:85,speed:96
                            });
                            startMysteryStatGame();
                            closeOverlayModal();
                        }""")
                        screen(page, "screen-game")
                        page.locator("#mystery-box").wait_for(state="visible")
                        wait(page, 'mysteryClues.length === 8 && mysteryClues[1].value === 71')
                        assert page.locator("#mystery-list .mystery-item").count() == 8
                        assert page.evaluate("mysteryClues[7].value") == 441
                        name = page.evaluate("secretPokemon.name")
                        page.screenshot(path=str(OUT / f"{engine}-{width}-mystery.png"), animations="disabled")
                        submit_name(page, name)
                        assert page.evaluate("gameMode") == "mystery"
                        assert page.locator("#mystery-reveal").is_visible(), "Solution not revealed"
                        assert name in page.locator("#mystery-name").inner_text()
                        page.screenshot(path=str(OUT / f"{engine}-{width}-mystery-solved.png"), animations="disabled")

                    execute("quiz-result", quiz_result)
                    execute("weight", weight)
                    execute("evolution", evolution)
                    execute("pokedex-order", order)
                    execute("intrus", odd)
                    execute("stat-mystere", mystery)
                    execute("javascript-errors", lambda: (_ for _ in ()).throw(AssertionError(errors)) if errors else None)
                finally:
                    await_close = context.close
                    await_close()
            browser.close()
    (OUT / "report.json").write_text(json.dumps(cases, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(1 for c in cases if c["ok"])
    print("SOLO_MODE_SUMMARY " + json.dumps({"passed": total, "failed": len(cases)-total}), flush=True)
    if total != len(cases):
        raise SystemExit(1)


if __name__ == "__main__":
    with (OUT / "server.log").open("w") as logfile:
        server = subprocess.Popen(
            ["node", "server.js"],
            cwd=ROOT / "App",
            stdout=logfile, stderr=subprocess.STDOUT,
            env=dict(os.environ, PORT="3195", DATABASE_URL="",
                     DISCORD_CLIENT_ID="", DISCORD_CLIENT_SECRET=""),
        )
        try:
            for _ in range(80):
                try:
                    urllib.request.urlopen(URL, timeout=2).close()
                    break
                except Exception:
                    if server.poll() is not None:
                        raise RuntimeError("Local QA server exited")
                    time.sleep(.25)
            else:
                raise RuntimeError("Local QA server did not start")
            run()
        finally:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
