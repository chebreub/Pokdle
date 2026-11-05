"""Unit tests for the no-credential, read-only public deployment check."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools import production_smoke as smoke


class ProductionSmokeTests(unittest.TestCase):
    def test_expected_build_is_read_from_generated_index(self):
        with tempfile.TemporaryDirectory() as directory:
            page = Path(directory) / "index.html"
            page.write_text(
                '<link rel="stylesheet" href="dist/app.min.css?v=123456789a">'
                '<script src="dist/script.min.js?v=abcdef0123"></script>',
                encoding="utf-8",
            )
            self.assertEqual(
                smoke.expected_assets(page),
                {"script": "abcdef0123", "css": "123456789a"},
            )
            page.write_text("<html>missing build</html>", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Cannot read versioned"):
                smoke.expected_assets(page)

    def test_success_checks_version_health_and_only_public_assets(self):
        urls = []
        data = {
            "/api/version": (b'{"ok":true,"build":"abcdef0123"}', "application/json"),
            "/api/multiplayer/health": (b'{"ok":true,"rooms":2,"pokemon":1025}', "application/json"),
            "/dist/script.min.js?v=abcdef0123": (b"x" * 1001, "application/javascript"),
            "/dist/app.min.css?v=123456789a": (b"x" * 1001, "text/css"),
        }

        def fake_fetch(path):
            urls.append(path)
            return data[path]

        with patch.object(smoke, "fetch", fake_fetch):
            result = smoke.verify({"script": "abcdef0123", "css": "123456789a"})
        self.assertEqual(result["pokemon_count"], 1025)
        self.assertEqual(urls, list(data))
        self.assertNotIn("/", urls)
        self.assertTrue(all(not path.startswith("/api/arcade/") for path in urls))

    def test_stale_deployment_does_not_check_other_resources(self):
        with patch.object(smoke, "fetch", return_value=(b'{"ok":true,"build":"0000000000"}', "application/json")) as fetch:
            with self.assertRaisesRegex(RuntimeError, "awaiting GitHub build"):
                smoke.verify({"script": "abcdef0123", "css": "123456789a"})
            fetch.assert_called_once_with("/api/version")

    def test_bad_health_and_broken_asset_are_errors(self):
        good_version = (b'{"ok":true,"build":"abcdef0123"}', "application/json")
        bad_health = (b'{"ok":true,"rooms":0,"pokemon":0}', "application/json")
        with patch.object(smoke, "fetch", side_effect=[good_version, bad_health]):
            with self.assertRaisesRegex(RuntimeError, "unexpected payload"):
                smoke.verify({"script": "abcdef0123", "css": "123456789a"})
        good_health = (b'{"ok":true,"rooms":0,"pokemon":1025}', "application/json")
        wrong_asset = (b"small", "text/html")
        with patch.object(smoke, "fetch", side_effect=[good_version, good_health, wrong_asset]):
            with self.assertRaisesRegex(RuntimeError, "wrong content type"):
                smoke.verify({"script": "abcdef0123", "css": "123456789a"})

    def test_requests_are_get_only_without_credentials(self):
        seen = []
        class Response:
            status = 200
            headers = {"Content-Type": "application/json"}
            def __enter__(self):
                return self
            def __exit__(self, *_):
                return False
            def read(self, *_):
                return b"{}"
        def fake_urlopen(request, timeout):
            seen.append((request, timeout))
            return Response()
        with patch.object(smoke, "urlopen", fake_urlopen):
            smoke.fetch("/api/version")
        request, timeout = seen[0]
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(request.full_url, "https://pokdle.fr/api/version")
        self.assertGreater(timeout, 0)
        self.assertNotIn("authorization", {k.lower() for k in request.headers})
        self.assertNotIn("cookie", {k.lower() for k in request.headers})
        for path in ("", "https://other.site", "//other.site"):
            with self.assertRaises(ValueError):
                smoke.fetch(path)


if __name__ == "__main__":
    unittest.main()
