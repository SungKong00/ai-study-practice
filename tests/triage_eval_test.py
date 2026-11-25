from pathlib import Path
import runpy
import unittest
from unittest.mock import patch


class TriageEvalTest(unittest.TestCase):
    def test_connection_failure_reports_the_request_without_more_submissions(self):
        script = Path(__file__).parents[1] / "workflows/n8n/evaluate.py"
        offline = patch("urllib.request.urlopen", side_effect=TimeoutError("timeout"))
        with offline as http, patch("sys.argv", [str(script)]):
            with self.assertRaises(SystemExit) as stopped:
                runpy.run_path(str(script), run_name="__main__")
        self.assertRegex(str(stopped.exception), r"eval-[0-9a-f]{32}.*timeout")
        http.assert_called_once()
