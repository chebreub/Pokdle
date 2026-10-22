"""Conservative PR smoke selection. Full QA still runs at review handoff.

The browser smoke is an early signal, not a replacement for the full browser,
database and multiplayer suite required on the current merge commit.
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

SOLO_FILES = {
    "App/index.html",
    "App/game-feel.css",
    "App/mobile.css",
    "App/visual-refresh.css",
    "App/src/script.02.statclash.js",
    "App/src/script.03.minijeux.js",
    "tools/solo_modes_quality.py",
}
DAILY_PREFIXES = (
    "App/lib/daily",
    "App/src/script.10o.",
    "App/src/script.10p.",
    "App/src/script.10q.",
    "App/src/script.10r.",
    "App/test/daily",
    "tools/wordle_quality.py",
    "tools/dossier_quality.py",
    "tools/challenge_quality.py",
    "App/wordle.css",
    "App/dossier.css",
    "App/challenge.css",
)
DB_TESTS = {
    "App/test/usage-metrics.test.js",
    "App/test/daily-petitbac.test.js",
    "App/test/daily-grid.test.js",
    "App/test/leaderboard-store.test.js",
    "App/test/egg-mystery.test.js",
}


def classify(paths: list[str]) -> tuple[str, bool]:
    paths = [p.strip() for p in paths if p.strip()]
    if not paths:
        return "general", True  # Unknown diff: conservative browser + DB check.

    db = any(
        p == "App/server.js"
        or p.startswith("App/lib/")
        or p in DB_TESTS
        or p == ".github/workflows/browser-quality.yml"
        for p in paths
    )
    # Only tests/doc changes: the separate Game regression workflow already
    # runs every unit test on PR pushes. No redundant browser installation.
    if all(p.startswith(("App/test/", "docs/")) for p in paths):
        return "none", db
    # Dedicated daily file families can be checked quickly on both browsers.
    if all(p.startswith(DAILY_PREFIXES) or p.startswith(("App/test/", "docs/"))
           for p in paths):
        return "daily", db
    # A Party-specific QA file gives an explicit signal; script.07 also owns
    # unrelated profile/saving logic and cannot safely select Party by itself.
    if "tools/party_mobile_quality.py" in paths and all(
        p in {"App/src/script.07.delegation-party.js", "tools/party_mobile_quality.py"}
        or p.startswith(("App/test/party-", "docs/")) for p in paths
    ):
        return "party", db
    # Shared mini-game JS/CSS can affect multiple games. When the PR updates
    # their dedicated QA, run the entire solo QA instead of guessing one mode.
    if "tools/solo_modes_quality.py" in paths and all(
        p in SOLO_FILES or p.startswith(("App/test/", "docs/")) for p in paths
    ):
        return "solo", db
    # Everything else receives general browser smoke. A full validation is
    # always required when the PR is marked ready for review.
    return "general", db


def changed_paths(base: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", base, "HEAD"],
        cwd=Path(__file__).resolve().parents[1],
        check=True, capture_output=True, text=True,
    )
    return result.stdout.splitlines()


def main() -> None:
    try:
        paths = changed_paths(os.getenv("QA_BASE") or "HEAD^")
        suite, db = classify(paths)
    except (OSError, subprocess.CalledProcessError) as error:
        print(f"Unable to classify diff ({error}); using conservative scope.")
        paths, suite, db = [], "general", True
    print("Changed files:", ", ".join(paths) or "(not resolved)")
    print("PR browser smoke:", suite, "| isolated database tests:", db)
    output = os.getenv("GITHUB_OUTPUT")
    if output:
        with Path(output).open("a", encoding="utf-8") as out:
            out.write(f"suite={suite}\n")
            out.write(f"db={'true' if db else 'false'}\n")


if __name__ == "__main__":
    main()
