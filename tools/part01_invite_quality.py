"""PART-01: live anonymous Dessine-le invite, guest join, changed game and expired link."""
import json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "quality-artifacts" / "part01-invite"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 3197
ORIGIN = "http://127.0.0.1:" + str(PORT)

def ready(page, code, timeout=16000):
    # Playwright's wait_for_function string eval violates the production CSP.
    # Evaluate an arrow callback as in the existing browser quality tests.
    deadline = time.monotonic() + timeout / 1000
    while time.monotonic() < deadline:
        if page.evaluate("() => (" + code + ")"):
            return
        page.wait_for_timeout(100)
    raise AssertionError("Condition not met: " + code)

def setup(page, url):
    page.set_default_timeout(15000)
    page.goto(url, wait_until="domcontentloaded")
    ready(page, 'typeof openPartyRoomWithGame === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length > 1000')
    ready(page, '!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')

def scenario(pw, engine, width):
    browser = getattr(pw, engine).launch()
    contexts = [browser.new_context(viewport={"width":width,"height":844 if width < 640 else 900},
             is_mobile=width < 640, has_touch=width < 640) for _ in range(4)]
    pages = []
    errors = []
    stage = "boot"
    try:
        host = contexts[0].new_page()
        pages.append(host)
        host.on("pageerror", lambda error: errors.append("host: "+str(error)))
        setup(host, ORIGIN + "/")
        stage = "create"
        host.evaluate('openPartyRoomWithGame("dessin")')
        host.locator("#party-nickname").fill("Host")
        host.locator('[data-action="partyCreateRoom"]').click()
        ready(host, 'partyRoomState.room?.gameMode === "dessin" && partyRoomState.room?.players?.length === 1')
        code = host.evaluate('partyRoomState.room.code')
        assert len(code) == 5
        host.evaluate('''() => {
          Object.defineProperty(navigator, "clipboard", {configurable:true,
            value:{writeText(text){ window.__part01Copied = text; return Promise.resolve(); }}});
        }''')
        host.locator('[data-action="partyCopyInviteLink"]').click()
        ready(host, 'Boolean(window.__part01Copied)')
        url = host.evaluate('window.__part01Copied')
        assert url == ORIGIN + "/?party=" + code + "&game=dessin", url

        stage = "anonymous guest"
        guest = contexts[1].new_page()
        pages.append(guest)
        guest.on("pageerror", lambda error: errors.append("guest: "+str(error)))
        setup(guest, url)
        guest.locator("#party-invite-notice.is-ready").wait_for(state="visible")
        invite = guest.locator("#party-invite-notice").inner_text()
        assert "Dessine-le !" in invite and "sans compte" in invite, invite
        assert guest.locator("#party-join-code").input_value() == code
        assert guest.evaluate('partyRoomState.room === null')
        assert guest.locator("#party-joined").is_hidden()
        guest.locator("#party-nickname").fill("Guest")
        guest.locator('[data-action="partyJoinRoom"]').click()
        ready(guest, 'partyRoomState.room?.gameMode === "dessin" && partyRoomState.room?.players?.length === 2')
        ready(host, 'partyRoomState.room?.players?.length === 2')
        assert guest.locator("#party-joined").is_visible()
        assert guest.evaluate('partyRoomState.room?.players?.find(p => p.isSelf)?.isHost') is False
        # No auth dialog or login requirement appeared.
        assert "/auth/" not in guest.url
        guest.screenshot(path=str(OUT / (engine + "-" + str(width) + "-joined.png")))

        stage = "changed game"
        host.evaluate('partySetMode("guess")')
        ready(host, 'partyRoomState.room?.gameMode === "guess"')
        changed = contexts[2].new_page()
        pages.append(changed)
        setup(changed, url)
        changed.locator("#party-invite-notice.is-error").wait_for(state="visible")
        actual_notice = changed.locator("#party-invite-notice").inner_text()
        assert "changé de jeu" in actual_notice, (
            "Expected a changed-game invitation, got: " + repr(actual_notice)
        )
        changed.locator("#party-nickname").fill("Wrong mode")
        changed.locator('[data-action="partyJoinRoom"]').click()
        ready(changed, 'document.getElementById("party-room-msg").textContent.includes("changé de jeu")')
        assert changed.evaluate('partyRoomState.room === null'), "A stale Dessine-le invite entered another game"

        stage = "legacy generic link"
        legacy = contexts[3].new_page()
        pages.append(legacy)
        setup(legacy, ORIGIN + "/?party=" + code)
        assert legacy.locator("#party-join-code").input_value() == code
        assert legacy.locator("#party-invite-notice").is_hidden(), "Old generic links must keep working"

        stage = "expired"
        guest.evaluate('partyLeaveRoom()')
        ready(host, 'partyRoomState.room?.players?.length === 1')
        host.evaluate('partyLeaveRoom()')
        # Wait until server has processed the host departure, not only browser state.
        # Asking the preview repeatedly is safe but must not create a room.
        expired = None
        for _ in range(20):
            try:
                expired = changed.evaluate('''(code) => new Promise(resolve => {
                  ensurePartyListeners().emit("party:invite-preview",{code,expectedMode:"dessin"},resolve);
                })''', code)
                if expired and expired.get("errorCode") == "invite_expired":
                    break
            except Exception:
                pass
            changed.wait_for_timeout(100)
        assert expired and expired.get("errorCode") == "invite_expired", expired
        # Opening the old link on a fresh page displays an explicit expiry.
        stale = contexts[3].new_page()
        pages.append(stale)
        setup(stale, url)
        stale.locator("#party-invite-notice.is-error").wait_for(state="visible")
        assert "expirée" in stale.locator("#party-invite-notice").inner_text()
        assert stale.evaluate('partyRoomState.room === null')
        assert not errors, errors
        return {"engine":engine,"width":width,"status":"ok","anonymousJoin":True,
                "presetGame":True,"changedModeRejected":True,"expiredClearly":True}
    except Exception as exc:
        return {"engine":engine,"width":width,"status":"failed","stage":stage,
                "error":str(exc),"pageErrors":errors[:5]}
    finally:
        for p in pages:
            try:
                if not p.is_closed(): p.close()
            except Exception: pass
        for c in contexts:
            try:c.close()
            except Exception:pass
        browser.close()

if __name__ == "__main__":
    server = subprocess.Popen(["node","server.js"],cwd=ROOT/"App",
      stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
      env=dict(os.environ,PORT=str(PORT),DATABASE_URL="",DISCORD_CLIENT_ID="",DISCORD_CLIENT_SECRET=""))
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(ORIGIN+"/",timeout=1).close()
                break
            except Exception:
                if server.poll() is not None:raise RuntimeError("QA server exited")
                time.sleep(.2)
        else:raise RuntimeError("QA server did not start")
        with sync_playwright() as pw:
            results = [scenario(pw,"chromium",390),scenario(pw,"webkit",1366)]
        (OUT/"report.json").write_text(json.dumps(results,indent=2,ensure_ascii=False))
        print(json.dumps(results,ensure_ascii=False))
        if any(row["status"] != "ok" for row in results):
            raise SystemExit(1)
    finally:
        server.terminate()
        try:server.wait(timeout=8)
        except subprocess.TimeoutExpired:server.kill()
