#!/usr/bin/env python3
"""Load audience.csv and content.csv into the BigQuery tables Terraform created.

    pip install -r ingest/requirements.txt
    gcloud auth application-default login      # once: lets this script act as you
    python3 ingest/load_to_bigquery.py --project YOUR_PROJECT_ID --data data/sample

Each run replaces the table contents with the files (WRITE_TRUNCATE). That
makes loading idempotent: run it as often as you like, the tables always
match the files exactly. The files are checked with the same rules as the
API before anything is uploaded.
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

import fan_data

TABLES = {
    "audience": ("audience.csv", fan_data.AUDIENCE_COLUMNS, fan_data.normalize_audience),
    "content": ("content.csv", fan_data.CONTENT_COLUMNS, fan_data.normalize_content),
}


def prepare_csv(path: Path, columns: tuple[str, ...], normalize) -> bytes:
    """Re-writes a checked file with lowercased platform names and clean whitespace,
    so the table holds exactly what the dashboard expects."""
    out = io.StringIO()
    fan_data.write_rows(out, columns, [normalize(row) for row in fan_data.read_rows(path, columns)])
    return out.getvalue().encode("utf-8")


def load(project: str, dataset: str, folder: Path, location: str) -> None:
    # Imported here so the tests above can run without the Google library.
    from google.cloud import bigquery

    client = bigquery.Client(project=project, location=location)
    for table, (filename, columns, normalize) in TABLES.items():
        table_id = f"{project}.{dataset}.{table}"
        job_config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.CSV,
            skip_leading_rows=1,
            # Replace, don't append: the files are the source of truth.
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
            # Use the schema Terraform created; fail if a column is missing.
            schema=client.get_table(table_id).schema,
        )
        data = prepare_csv(folder / filename, columns, normalize)
        job = client.load_table_from_file(io.BytesIO(data), table_id, job_config=job_config)
        job.result()  # waits, and raises if the load failed
        print(f"Loaded {job.output_rows} rows into {table_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project", required=True, help="Google Cloud project ID")
    parser.add_argument("--data", default="data/sample", help="folder with audience.csv and content.csv")
    parser.add_argument("--dataset", default="fan_insights")
    parser.add_argument("--location", default="US", help="BigQuery location (must match Terraform)")
    args = parser.parse_args()

    folder = Path(args.data)
    problems = fan_data.check_folder(folder)
    if problems:
        print(f"Not loading: {folder} has {len(problems)} problem(s):", *problems[:20], sep="\n  ")
        return 1
    load(args.project, args.dataset, folder, args.location)
    return 0


if __name__ == "__main__":
    sys.exit(main())
