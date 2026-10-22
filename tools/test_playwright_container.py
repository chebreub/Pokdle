"""Regression checks for our Playwright GitHub Actions container migration.

These assertions protect the browser coverage and disposable PostgreSQL URL;
they do not connect to any database or production service.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (ROOT / ".github/workflows/browser-quality.yml").read_text(encoding="utf-8")
REGRESSION = (ROOT / ".github/workflows/game-tests.yml").read_text(encoding="utf-8")
POLICY = (ROOT / "docs/qa/ci-policy.md").read_text(encoding="utf-8")


class PlaywrightContainerWorkflowTest(unittest.TestCase):
    def test_pinned_preinstalled_image_and_python_client_match(self):
        self.assertIn("image: mcr.microsoft.com/playwright/python:v1.55.0-noble", WORKFLOW)
        self.assertIn("playwright==1.55.0", WORKFLOW)
        self.assertNotIn("playwright install --with-deps", WORKFLOW)
        self.assertNotIn("actions/cache@v4", WORKFLOW)
        self.assertIn("Verify preinstalled Chromium and WebKit", WORKFLOW)
        self.assertIn('for name in ("chromium", "webkit"):', WORKFLOW)

    def test_containerized_postgres_never_points_at_production_or_localhost(self):
        self.assertIn("image: postgres:16", WORKFLOW)
        self.assertIn("QA_DATABASE_URL: postgresql://qa:qa-local-only@postgres:5432/pokdle_qa", WORKFLOW)
        self.assertNotIn("QA_DATABASE_URL: postgresql://qa:qa-local-only@localhost:", WORKFLOW)
        for file_name in (
            "test/usage-metrics.test.js",
            "test/daily-petitbac.test.js",
            "test/leaderboard-store.test.js",
            "test/daily-grid.test.js",
            "test/egg-mystery.test.js",
        ):
            self.assertIn(file_name, WORKFLOW)

    def test_full_browser_coverage_and_manual_gate_remain(self):
        self.assertIn("ready_for_review", WORKFLOW)
        self.assertIn("QA_FULL:", WORKFLOW)
        self.assertIn("workflow_dispatch:", WORKFLOW)
        self.assertIn("Browser smoke for changed PR area", WORKFLOW)
        for script in (
            "tools/solo_modes_quality.py",
            "tools/multiplayer_quality.py",
            "tools/petitbac_quality.py",
            "tools/browser_quality.py",
            "tools/dossier_quality.py",
            "tools/wordle_quality.py",
        ):
            self.assertIn(script, WORKFLOW)
        self.assertIn("if: env.QA_FULL == 'true'", WORKFLOW)

    def test_workflow_only_change_still_runs_unit_regression(self):
        self.assertIn('".github/workflows/browser-quality.yml"', REGRESSION)
        self.assertIn("image officielle Playwright", POLICY)


if __name__ == "__main__":
    unittest.main()
