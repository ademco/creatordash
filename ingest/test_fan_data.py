"""Tests for fan_data.py. Run with: python3 -m unittest discover ingest"""

import csv
import tempfile
import unittest
from pathlib import Path

import fan_data

TEMPLATES = Path(__file__).resolve().parent.parent / "data" / "templates"
SAMPLE = Path(__file__).resolve().parent.parent / "data" / "sample"


class CheckFolderTest(unittest.TestCase):
    def test_templates_and_sample_data_pass(self):
        self.assertEqual(fan_data.check_folder(TEMPLATES), [])
        self.assertEqual(fan_data.check_folder(SAMPLE), [])

    def test_reports_bad_rows_and_missing_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "audience.csv").write_text("date,platform,audience\n2026-02-30,myspace,1.5k\n")
            problems = fan_data.check_folder(tmp)
        joined = "\n".join(problems)
        self.assertIn('line 2: date "2026-02-30"', joined)
        self.assertIn('platform "myspace"', joined)
        self.assertIn('audience "1.5k"', joined)
        self.assertIn("content.csv: file not found", joined)

    def test_reports_missing_columns(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "audience.csv").write_text("day,followers\n")
            Path(tmp, "content.csv").write_text(Path(TEMPLATES, "content.csv").read_text())
            self.assertIn("missing column(s) date, platform, audience", fan_data.check_folder(tmp)[0])


class UpsertTest(unittest.TestCase):
    def test_upsert_audience_adds_then_replaces_by_date_and_platform(self):
        with tempfile.TemporaryDirectory() as tmp:
            fan_data.upsert_audience(tmp, [{"date": "2026-10-02", "platform": "Spotify", "audience": "10"}])
            fan_data.upsert_audience(tmp, [{"date": "2026-10-01", "platform": "tiktok", "audience": 5}])
            fan_data.upsert_audience(tmp, [{"date": "2026-10-02", "platform": "spotify", "audience": 12}])
            text = Path(tmp, "audience.csv").read_text()
        self.assertEqual(text, "date,platform,audience\n2026-10-01,tiktok,5\n2026-10-02,spotify,12\n")

    def test_upsert_content_quotes_titles_with_commas_and_updates_views(self):
        row = {"published_date": "2026-10-01", "platform": "youtube", "content_type": "video",
               "title": 'Mixing, mastering, and "coffee"', "views": 100}
        with tempfile.TemporaryDirectory() as tmp:
            fan_data.upsert_content(tmp, [row])
            fan_data.upsert_content(tmp, [{**row, "views": 250}])
            path = Path(tmp, "content.csv")
            with path.open(newline="") as f:
                rows = list(csv.DictReader(f))
            raw = path.read_text()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["views"], "250")
        self.assertIn('"Mixing, mastering, and ""coffee"""', raw)

    def test_rejects_invalid_rows_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                fan_data.upsert_audience(tmp, [{"date": "yesterday", "platform": "spotify", "audience": 1}])
            self.assertFalse(Path(tmp, "audience.csv").exists())


if __name__ == "__main__":
    unittest.main()
