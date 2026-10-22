"""Unit tests for the conservative PR browser-smoke classifier."""
import unittest
from tools.ci_smoke_scope import classify


class SmokeScopeTest(unittest.TestCase):
    def test_quiz_result_ui_with_qa_is_solo(self):
        self.assertEqual(classify([
            "App/index.html", "App/src/script.03.minijeux.js",
            "App/game-feel.css", "tools/solo_modes_quality.py",
        ]), ("solo", False))

    def test_daily_specific_is_daily(self):
        self.assertEqual(classify([
            "App/src/script.10o.daily-wordle.js",
            "App/test/daily-wordle.test.js",
        ]), ("daily", True))

    def test_wordle_database_test_alone_needs_postgresql_not_browsers(self):
        self.assertEqual(classify(["App/test/daily-wordle.test.js"]), ("none", True))

    def test_party_qa_is_party(self):
        self.assertEqual(classify([
            "App/src/script.07.delegation-party.js",
            "tools/party_mobile_quality.py",
        ]), ("party", False))

    def test_shared_profile_is_not_mistaken_for_party(self):
        self.assertEqual(classify(["App/src/script.07.delegation-party.js"]), ("general", False))

    def test_server_requires_database_and_browser(self):
        self.assertEqual(classify(["App/server.js"]), ("general", True))

    def test_database_unit_only_without_playwright(self):
        self.assertEqual(classify(["App/test/leaderboard-store.test.js"]), ("none", True))

    def test_only_unit_tests_need_no_browser(self):
        self.assertEqual(classify(["App/test/game-shell.test.js"]), ("none", False))

    def test_broad_mode_edit_is_conservative(self):
        self.assertEqual(classify([
            "App/src/script.03.minijeux.js", "App/style.css",
        ]), ("general", False))

    def test_workflow_change_checks_database(self):
        self.assertEqual(classify([
            ".github/workflows/browser-quality.yml", "tools/ci_smoke_scope.py",
        ]), ("general", True))

    def test_unknown_diff_is_conservative(self):
        self.assertEqual(classify([]), ("general", True))


if __name__ == "__main__":
    unittest.main()
