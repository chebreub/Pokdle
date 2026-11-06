"""PC-01: real two-browser Pokédex Race layout on a compact desktop viewport.

Uses an isolated guest room: no account, production data or game-economy writes.
Chrome/WebKit screenshots and measurements are stored as QA artifacts.
"""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "quality-artifacts" / "pc-desktop"
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://127.0.0.1:3194/"


def wait_app(page):
    page.goto(URL, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_function(
        '() => typeof openPartyRoomMode === "function" && '
        'typeof startNormalGame === "function" && '
        'typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length > 1000',
        timeout=25000,
    )
    page.wait_for_function(
        '() => !document.getElementById("app-splash") || '
        'getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"',
        timeout=16000,
    )
    page.evaluate("closeOverlayModal()")


def rect_checks(value, width, height):
    # All race controls must be reachable without page scrolling or cropping.
    for key in ("header", "scoreboard", "clock", "exit", "panel", "wrap", "board", "footer", "field", "submit"):
        rect = value[key]
        assert rect["width"] > 0 and rect["height"] > 0, (key, value)
        assert rect["left"] >= -2 and rect["right"] <= width + 2, (key, value)
        assert rect["top"] >= -2 and rect["bottom"] <= height + 2, (key, value)
    wrap, board = value["wrap"], value["board"]
    assert board["left"] >= wrap["left"] - 2 and board["right"] <= wrap["right"] + 2, value
    assert board["top"] >= wrap["top"] - 2 and board["bottom"] <= wrap["bottom"] + 2, value
    assert value["columns"] > 0 and value["count"] == 151, value
    assert value["cell"] >= 32, "Unreadable cells on a desktop viewport: " + repr(value)
    assert value["bodyOverflow"] == "hidden", "Race view permits unwanted page scroll: " + repr(value)
    assert value["documentOverflow"] <= 2, "Horizontal document overflow: " + repr(value)


def race_geometry(page):
    return page.evaluate("""() => {
      const byId = id => document.getElementById(id);
      const r = el => {
        const box = el.getBoundingClientRect();
        return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,
          width:box.width,height:box.height};
      };
      const board = byId('dex-race-board');
      return {
        header:r(document.querySelector('#dex-race-arena .race-header')),
        scoreboard:r(byId('dex-race-scoreboard')),
        clock:r(byId('dex-race-clock')),
        exit:r(document.querySelector('#dex-race-arena .race-exit')),
        panel:r(document.querySelector('#dex-race-arena .race-board-panel')),
        wrap:r(byId('dex-race-board-wrap')),
        board:r(board),
        footer:r(document.querySelector('#dex-race-arena .race-footer')),
        field:r(byId('dex-race-input')),
        submit:r(byId('dex-race-submit')),
        columns:Number(board.style.getPropertyValue('--race-cols')),
        cell:byId('race-cell-1')?.getBoundingClientRect().width || 0,
        count:board.children.length,
        bodyOverflow:getComputedStyle(document.body).overflow,
        documentOverflow:document.documentElement.scrollWidth-innerWidth
      };
    }""")


def test_classic_game(page):
    page.evaluate("() => {closeOverlayModal(); startNormalGame(); closeOverlayModal();}")
    page.wait_for_function(
        "() => !document.getElementById('screen-game').classList.contains('hidden') "
        "&& document.getElementById('screen-game').dataset.gameMode === 'normal'",
        timeout=12000,
    )
    game = page.evaluate("""() => {
      const input = document.getElementById('guess-input').getBoundingClientRect();
      const shell = document.querySelector('#screen-game .classic-game-shell').getBoundingClientRect();
      const bar = document.querySelector('#screen-game .game-topbar').getBoundingClientRect();
      const command = document.querySelector('#screen-game .classic-game-command').getBoundingClientRect();
      const style = getComputedStyle(document.querySelector('#screen-game .classic-game-shell'));
      return {inputWidth:input.width,inputBottom:input.bottom,shellWidth:shell.width,
        commandBottom:command.bottom,topbarBottom:bar.bottom,columns:style.gridTemplateColumns,
        documentOverflow:document.documentElement.scrollWidth-innerWidth};
    }""")
    assert game["inputWidth"] >= 150, game
    assert game["topbarBottom"] < 768 and game["inputBottom"] < 768, game
    assert game["documentOverflow"] <= 2, game
    assert len(game["columns"].split()) == 2, "Desktop should have a main game and secondary panel: " + repr(game)
    page.screenshot(path=str(OUT / "1366-classic.png"), animations="disabled")
    return game


def run_engine(playwright, engine, result):
    browser = getattr(playwright, engine).launch()
    contexts = []
    try:
        for _ in range(2):
            contexts.append(browser.new_context(
                viewport={"width":1366,"height":768}, reduced_motion="reduce",
            ))
        host, guest = [context.new_page() for context in contexts]
        errors = []
        for page in (host, guest):
            page.set_default_timeout(12000)
            page.on("pageerror", lambda error: errors.append(str(error)))
            wait_app(page)

        if engine == "chromium":
            result["classic"] = test_classic_game(host)
        for page in (host, guest):
            page.evaluate("() => {closeOverlayModal(); openPartyRoomMode();}")
        host.locator("#party-nickname").fill("PC-01 Host")
        host.locator('[data-action="partyCreateRoom"]').click()
        host.locator("#party-joined").wait_for(state="visible")
        code = host.locator("#party-room-code").inner_text().strip()
        assert code and code != "—"

        guest.locator("#party-nickname").fill("PC-01 Guest")
        guest.locator("#party-join-code").fill(code)
        guest.locator('[data-action="partyJoinRoom"]').click()
        guest.locator("#party-joined").wait_for(state="visible")
        host.wait_for_function("() => partyRoomState.room?.players?.length === 2")

        host.locator("#party-mode-dexrace").click()
        host.wait_for_function('() => partyRoomState.room?.gameMode === "dexrace"')
        host.locator("#party-start-btn").click()
        for page in (host, guest):
            page.locator("#dex-race-arena").wait_for(state="visible")
            page.wait_for_function(
                "() => document.getElementById('dex-race-board').children.length === 151 && "
                "Number(document.getElementById('dex-race-board').style.getPropertyValue('--race-cols')) > 0"
            )

        sizes = [(1280,720),(1366,768),(1600,900),(1920,1080)]
        if engine == "webkit":
            sizes = [(1366,768)]
        for width, height in sizes:
            host.set_viewport_size({"width":width,"height":height})
            guest.set_viewport_size({"width":width,"height":height})
            for page in (host, guest):
                page.wait_for_function("""() => {
                  const a=document.getElementById('dex-race-board');
                  const b=document.getElementById('dex-race-board-wrap');
                  return a.getBoundingClientRect().width<=b.getBoundingClientRect().width+2 &&
                    a.getBoundingClientRect().height<=b.getBoundingClientRect().height+2 &&
                    a.getBoundingClientRect().width>20;
                }""")
                measured = race_geometry(page)
                rect_checks(measured, width, height)
                result.setdefault("viewports", []).append({
                    "engine":engine, "role":"host" if page is host else "guest",
                    "width":width,"height":height,
                    "cell":measured["cell"],"columns":measured["columns"],
                })
            host.screenshot(
                path=str(OUT / ("%s-%s-race.png" % (engine, width))),
                animations="disabled",
            )

        # A real server-authoritative claim must show its sprite in both browsers;
        # another player proposing the same Pokémon must not gain the case.
        pokemon = host.evaluate("""() => {
          const id=partyRoomState.room.round.ids[0];
          return {id,name:POKEMON_BY_ID.get(id)?.name};
        }""")
        assert pokemon["name"], pokemon
        host.locator("#dex-race-input").fill(pokemon["name"])
        host.locator("#dex-race-input").press("Enter")
        selector = "#race-cell-%s.is-claimed img" % pokemon["id"]
        for page in (host, guest):
            page.locator(selector).wait_for(state="attached", timeout=12000)
            assert page.locator("#dex-race-scoreboard").is_visible()
        guest.locator("#dex-race-input").fill(pokemon["name"])
        guest.locator("#dex-race-input").press("Enter")
        guest.wait_for_function(
            """() => document.getElementById('dex-race-message')?.textContent.includes('déjà inscrit')""",
            timeout=12000,
        )
        assert host.evaluate(
            "partyRoomState.room.round.scores.blue + partyRoomState.room.round.scores.coral"
        ) == 1, "Duplicate guess must not alter scores"
        assert not errors, errors[:10]
        result["claim"] = {"pokemon":pokemon["name"],"duplicateRefused":True}
    finally:
        for context in contexts:
            context.close()
        browser.close()


def main():
    report = {"ok":False,"scope":"isolated localhost PC-01 desktop game and 2-player Pokédex Race"}
    log = (OUT / "server.log").open("w")
    server = subprocess.Popen(
        ["node","server.js"], cwd=ROOT/"App", stdout=log, stderr=subprocess.STDOUT,
        env=dict(os.environ,PORT="3194",DATABASE_URL="",
                 DISCORD_CLIENT_ID="",DISCORD_CLIENT_SECRET=""),
    )
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(URL,timeout=2).close()
                break
            except Exception:
                if server.poll() is not None:
                    raise RuntimeError("Local QA server exited")
                time.sleep(.25)
        else:
            raise RuntimeError("Local QA server did not start")

        with sync_playwright() as playwright:
            for engine in ("chromium","webkit"):
                run_engine(playwright, engine, report)
        report["ok"] = True
    except Exception as error:
        report["error"] = repr(error)
        raise
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
        log.close()
        (OUT / "report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print("PC_01_DESKTOP",json.dumps(report,ensure_ascii=False),flush=True)


if __name__ == "__main__":
    main()
