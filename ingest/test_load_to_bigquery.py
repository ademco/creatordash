"""Tests the part of the loader that runs before anything touches BigQuery."""

import tempfile
import unittest
from pathlib import Path

import fan_data
import load_to_bigquery


class PrepareCsvTest(unittest.TestCase):
    def test_normalizes_platforms_and_keeps_quoted_titles(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, "content.csv")
            path.write_text(
                'published_date,platform,content_type,title,views\n'
                '2026-09-15, TikTok ,Short,"Fan duet: ""Glass Houses"", acoustic",48055\n'
            )
            data = load_to_bigquery.prepare_csv(path, fan_data.CONTENT_COLUMNS, fan_data.normalize_content)
        self.assertEqual(
            data.decode(),
            'published_date,platform,content_type,title,views\n'
            '2026-09-15,tiktok,short,"Fan duet: ""Glass Houses"", acoustic",48055\n',
        )


if __name__ == "__main__":
    unittest.main()
