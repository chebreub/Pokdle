"""Two-browser QA for competitive 1v1 room recovery after refresh."""
import argparse, json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

def wait(page, predicate, message, timeout=15000):
    page.wait_for_function(predicate, timeout=timeout)
    if not page.evaluate(predicate):
        raise AssertionError(message)

def boot(page, url):
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_function(
        'typeof showScreen === "function" && typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length > 1000',
        timeout=45000,
    )
    page.wait_for_function(
        '!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"',
        timeout=20000,
    )
    page.evaluate('typeof closeOverlayModal === "function" && closeOverlayModal()')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="quality-artifacts/competitive")
    args = parser.parse_args()
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    log = (out / "server.log").open("w")
    env = dict(os.environ, PORT="3191", DATABASE_URL="", DISCORD_CLIENT_ID="", DISCORD_CLIENT_SECRET="")
    server = subprocess.Popen(["node", "server.js"], cwd=ROOT / "App", env=env, stdout=log, stderr=subprocess.STDOUT)
    url = "http://127.0.0.1:3191/"
    report = {"ok": False, "checks": [], "stage": "boot"}

    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(url, timeout=2).close()
                break
            except Exception:
                if server.poll() is not None:
                    raise RuntimeError("QA server exited; see server.log")
                time.sleep(0.25)
        else:
            raise RuntimeError("QA server did not start")

        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            host_ctx = browser.new_context(viewport={"width": 1366, "height": 900}, reduced_motion="reduce")
            guest_ctx = browser.new_context(viewport={"width": 1366, "height": 900}, reduced_motion="reduce")
            host = host_ctx.new_page()
            guest = guest_ctx.new_page()
            errors = []
            host.on("pageerror", lambda e: errors.append("host: " + str(e)))
            guest.on("pageerror", lambda e: errors.append("guest: " + str(e)))
            try:
                boot(host, url)
                boot(guest, url)

                # --- Stat Clash ---
                report["stage"] = "stat-clash-create"
                host.evaluate("""() => {
                  openStatClashMode();
                  switchStatClashMode("room");
                  statClashState.roomNameDraft = "QA Clash Host";
                  createStatClashRoom();
                }""")
                wait(host, '() => Boolean(statClashState?.room?.code)', "Stat Clash host room was not created")
                clash_code = host.evaluate("() => statClashState.room.code")

                report["stage"] = "stat-clash-join"
                guest.evaluate("""(code) => {
                  openStatClashMode();
                  switchStatClashMode("room");
                  statClashState.roomNameDraft = "QA Clash Guest";
                  statClashState.roomCodeDraft = code;
                  joinStatClashRoom();
                }""", clash_code)
                wait(guest, '() => Boolean(statClashState?.room?.players?.find(p => p.isSelf))', "Stat Clash guest did not join")
                wait(host, '() => statClashState?.room?.players?.length === 2', "Stat Clash host did not see guest")

                report["stage"] = "stat-clash-host-refresh"
                host.reload(wait_until="domcontentloaded", timeout=45000)
                wait(host, '() => typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length > 1000', "Stat Clash host app did not reboot")
                wait(host, '() => Boolean(statClashState?.room?.players?.find(p => p.isSelf)?.isHost)', "Stat Clash host ownership was not restored")
                if host.evaluate("() => statClashState.room.code") != clash_code:
                    raise AssertionError("Stat Clash host resumed the wrong room")
                host.locator("#screen-stat-clash").wait_for(state="visible")

                report["stage"] = "stat-clash-guest-refresh"
                guest.reload(wait_until="domcontentloaded", timeout=45000)
                wait(guest, '() => typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length > 1000', "Stat Clash guest app did not reboot")
                wait(guest, '() => Boolean(statClashState?.room?.players?.find(p => p.isSelf))', "Stat Clash guest seat was not restored")
                if guest.evaluate("() => statClashState.room.code") != clash_code:
                    raise AssertionError("Stat Clash guest resumed the wrong room")
                wait(host, '() => statClashState?.room?.connectedCount === 2', "Stat Clash guest stayed disconnected")
                host.screenshot(path=str(out / "stat-clash-host-resumed.png"), animations="disabled")
                guest.screenshot(path=str(out / "stat-clash-guest-resumed.png"), animations="disabled")

                report["stage"] = "stat-clash-explicit-leave"
                guest.evaluate("leaveStatClashRoom()")
                wait(host, '() => statClashState?.room?.players?.length === 1', "Stat Clash explicit leave did not release the guest seat")
                report["checks"] += [
                    "Stat Clash create/join",
                    "Stat Clash host refresh keeps host role",
                    "Stat Clash guest refresh restores seat",
                    "Stat Clash explicit leave releases seat",
                ]

                # Moving away is an explicit host departure, so the next room starts cleanly.
                host.evaluate("goToConfig()")
                guest.evaluate("goToConfig()")

                # --- Stat Auction ---
                report["stage"] = "stat-auction-create"
                host.evaluate("""() => {
                  openStatAuctionMode();
                  statAuctionState.roomNicknameDraft = "QA Auction Host";
                  createStatAuctionRoom();
                }""")
                wait(host, '() => Boolean(statAuctionState?.room?.code)', "Stat Auction host room was not created")
                auction_code = host.evaluate("() => statAuctionState.room.code")

                report["stage"] = "stat-auction-join"
                guest.evaluate("""(code) => {
                  openStatAuctionMode();
                  statAuctionState.roomNicknameDraft = "QA Auction Guest";
                  statAuctionState.roomDraftCode = code;
                  joinStatAuctionRoom();
                }""", auction_code)
                wait(guest, '() => Boolean(statAuctionState?.room?.players?.find(p => p.isSelf))', "Stat Auction guest did not join")
                wait(host, '() => statAuctionState?.room?.players?.length === 2', "Stat Auction host did not see guest")

                report["stage"] = "stat-auction-host-refresh"
                host.reload(wait_until="domcontentloaded", timeout=45000)
                wait(host, '() => typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length > 1000', "Stat Auction host app did not reboot")
                wait(host, '() => Boolean(statAuctionState?.room?.players?.find(p => p.isSelf)?.isHost)', "Stat Auction host ownership was not restored")
                if host.evaluate("() => statAuctionState.room.code") != auction_code:
                    raise AssertionError("Stat Auction host resumed the wrong room")
                host.locator("#screen-stat-auction").wait_for(state="visible")

                report["stage"] = "stat-auction-guest-refresh"
                guest.reload(wait_until="domcontentloaded", timeout=45000)
                wait(guest, '() => typeof POKEMON_LIST !== "undefined" && POKEMON_LIST.length > 1000', "Stat Auction guest app did not reboot")
                wait(guest, '() => Boolean(statAuctionState?.room?.players?.find(p => p.isSelf))', "Stat Auction guest seat was not restored")
                if guest.evaluate("() => statAuctionState.room.code") != auction_code:
                    raise AssertionError("Stat Auction guest resumed the wrong room")
                wait(host, '() => statAuctionState?.room?.connectedCount === 2', "Stat Auction guest stayed disconnected")
                host.screenshot(path=str(out / "stat-auction-host-resumed.png"), animations="disabled")
                guest.screenshot(path=str(out / "stat-auction-guest-resumed.png"), animations="disabled")

                report["stage"] = "stat-auction-explicit-leave"
                guest.evaluate("leaveStatAuctionRoom()")
                wait(host, '() => statAuctionState?.room?.players?.length === 1', "Stat Auction explicit leave did not release the guest seat")

                if errors:
                    raise AssertionError(repr(errors))
                report["checks"] += [
                    "Stat Auction create/join",
                    "Stat Auction host refresh keeps host role",
                    "Stat Auction guest refresh restores seat",
                    "Stat Auction explicit leave releases seat",
                ]
                report["ok"] = True
            finally:
                host_ctx.close()
                guest_ctx.close()
                browser.close()
    except Exception as exc:
        report["error"] = str(exc)
        raise
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
        log.close()
        (out / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print("COMPETITIVE_QA " + json.dumps(report, ensure_ascii=True), flush=True)

if __name__ == "__main__":
    main()
