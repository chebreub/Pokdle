"""Read-only check that the public Pokedle server serves the current GitHub build.

Run from GitHub Actions after a main deployment. Intentionally never request "/":
the home page increments visitor counters. No account, cookie, reward or POST.
"""
import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SCRIPT_RE = re.compile(r'dist/script\.min\.js\?v=([0-9a-f]{10})')
CSS_RE = re.compile(r'dist/app\.min\.css\?v=([0-9a-f]{10})')
BASE = "https://pokdle.fr"
HEADERS = {
    "User-Agent": "Pokdle-readonly-production-check/1.0",
    "Accept": "application/json,text/plain,text/css,application/javascript,*/*",
    "Cache-Control": "no-cache",
}


def expected_assets(index_path):
    page = Path(index_path).read_text(encoding="utf-8")
    script = SCRIPT_RE.search(page)
    style = CSS_RE.search(page)
    if not script or not style:
        raise ValueError("Cannot read versioned script and CSS from the built index")
    return {"script": script.group(1), "css": style.group(1)}


def fetch(path, timeout=12):
    # Fixed, public, same-origin, read-only endpoints: no login or secret is used.
    if not path.startswith("/") or path.startswith("//"):
        raise ValueError("Only same-origin public paths are allowed")
    request = Request(BASE + path, headers=HEADERS, method="GET")
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"{path}: HTTP {response.status}")
        content = response.read(8_000_001)
        if len(content) > 8_000_000:
            raise RuntimeError(f"{path}: response unexpectedly large")
        return content, response.headers.get("Content-Type", "").lower()


def json_endpoint(path):
    content, _ = fetch(path)
    try:
        value = json.loads(content)
    except (ValueError, UnicodeDecodeError) as exc:
        raise RuntimeError(f"{path}: invalid JSON") from exc
    if not isinstance(value, dict):
        raise RuntimeError(f"{path}: expected a JSON object")
    return value


def verify(expected):
    version = json_endpoint("/api/version")
    actual = version.get("build")
    if version.get("ok") is not True or not isinstance(actual, str) or not re.fullmatch(r"[0-9a-f]{10}", actual):
        raise RuntimeError("/api/version: invalid build identifier")
    if actual != expected["script"]:
        raise RuntimeError(f"Render has build {actual}; awaiting GitHub build {expected['script']}")

    health = json_endpoint("/api/multiplayer/health")
    if (health.get("ok") is not True
            or type(health.get("pokemon")) is not int or health["pokemon"] < 1000
            or type(health.get("rooms")) is not int or health["rooms"] < 0):
        raise RuntimeError("/api/multiplayer/health: unexpected payload")

    for asset, version_hash, media_type in (
        ("script.min.js", expected["script"], "javascript"),
        ("app.min.css", expected["css"], "css"),
    ):
        body, content_type = fetch(f"/dist/{asset}?v={version_hash}")
        if len(body) < 1000 or media_type not in content_type:
            raise RuntimeError(f"/dist/{asset}: missing, too small or wrong content type")

    return {
        "build": actual,
        "css": expected["css"],
        "pokemon_count": health["pokemon"],
        "checked": [
            "/api/version",
            "/api/multiplayer/health",
            "/dist/script.min.js",
            "/dist/app.min.css",
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", default="App/dist/index.html")
    parser.add_argument("--wait-seconds", type=int, default=600)
    parser.add_argument("--interval-seconds", type=int, default=20)
    parser.add_argument("--report", default="quality-artifacts/production-smoke/report.json")
    args = parser.parse_args()
    if args.wait_seconds < 0 or args.interval_seconds < 1:
        parser.error("Invalid retry interval or timeout")

    expected = expected_assets(args.index)
    deadline = time.monotonic() + args.wait_seconds
    attempts = 0
    result = None
    last_error = ""
    while True:
        attempts += 1
        try:
            result = verify(expected)
            break
        except Exception as exc:
            last_error = str(exc)[:500]
            print(f"Attempt {attempts}: {last_error}", flush=True)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(args.interval_seconds, remaining))

    report = {
        "ok": result is not None,
        "base": BASE,
        "expected": expected,
        "attempts": attempts,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        **(result or {"error": last_error}),
    }
    out = Path(args.report)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    return 0 if result else 1


if __name__ == "__main__":
    raise SystemExit(main())
