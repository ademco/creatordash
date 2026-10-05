#!/usr/bin/env python3
"""Check and add to a Fan Insights data folder (audience.csv + content.csv).

This is the adapter between your own analytics scripts and the dashboard.
Import it from a script, or use it from the command line:

    python3 ingest/fan_data.py check data/real
    python3 ingest/fan_data.py add-audience data/real 2026-10-05 spotify 18500
    python3 ingest/fan_data.py add-content data/real 2026-10-04 youtube video "My new video" 3100

From Python:

    from fan_data import upsert_audience, upsert_content, check_folder
    upsert_audience("data/real", [{"date": "2026-10-05", "platform": "spotify", "audience": 18500}])

Standard library only, so there is nothing to install. The rules match the
API's validation (api/src/rows.ts), so a folder that passes here loads there.
"""

from __future__ import annotations

import csv
import sys
from datetime import date
from pathlib import Path

PLATFORMS = ("spotify", "youtube", "twitch", "kick", "tiktok")
CONTENT_TYPES = ("release", "video", "stream", "short")
AUDIENCE_COLUMNS = ("date", "platform", "audience")
CONTENT_COLUMNS = ("published_date", "platform", "content_type", "title", "views")


def _is_iso_date(value: str) -> bool:
    try:
        return date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def _is_count(value: str) -> bool:
    return value.strip().isdigit()


def check_audience_row(row: dict, line: int) -> list[str]:
    problems = []
    if not _is_iso_date(str(row.get("date", "")).strip()):
        problems.append(f'line {line}: date "{row.get("date")}" should look like 2026-09-30')
    if str(row.get("platform", "")).strip().lower() not in PLATFORMS:
        problems.append(f'line {line}: platform "{row.get("platform")}" should be one of {", ".join(PLATFORMS)}')
    if not _is_count(str(row.get("audience", ""))):
        problems.append(f'line {line}: audience "{row.get("audience")}" should be a whole number like 12345')
    return problems


def check_content_row(row: dict, line: int) -> list[str]:
    problems = []
    if not _is_iso_date(str(row.get("published_date", "")).strip()):
        problems.append(f'line {line}: published_date "{row.get("published_date")}" should look like 2026-09-30')
    if str(row.get("platform", "")).strip().lower() not in PLATFORMS:
        problems.append(f'line {line}: platform "{row.get("platform")}" should be one of {", ".join(PLATFORMS)}')
    if str(row.get("content_type", "")).strip().lower() not in CONTENT_TYPES:
        problems.append(
            f'line {line}: content_type "{row.get("content_type")}" should be one of {", ".join(CONTENT_TYPES)}'
        )
    if not str(row.get("title", "")).strip():
        problems.append(f"line {line}: title is empty")
    if not _is_count(str(row.get("views", ""))):
        problems.append(f'line {line}: views "{row.get("views")}" should be a whole number like 12345')
    return problems


def _read(path: Path, columns: tuple[str, ...]) -> list[dict]:
    if not path.exists():
        return []
    # utf-8-sig drops the byte-order mark Excel and Google Sheets add.
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        header = [name.strip().lower() for name in reader.fieldnames or []]
        missing = [c for c in columns if c not in header]
        if missing:
            raise ValueError(f"{path}: missing column(s) {', '.join(missing)}. Found: {', '.join(header)}")
        reader.fieldnames = header
        return [{k: (v or "").strip() for k, v in row.items() if k} for row in reader]


def _write(path: Path, columns: tuple[str, ...], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        # QUOTE_MINIMAL quotes only fields that need it, e.g. titles with commas.
        writer = csv.DictWriter(f, fieldnames=columns, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def check_folder(folder: str | Path) -> list[str]:
    """Returns a list of problems; an empty list means the folder is ready to use."""
    folder = Path(folder)
    problems: list[str] = []
    for name, columns, check in (
        ("audience.csv", AUDIENCE_COLUMNS, check_audience_row),
        ("content.csv", CONTENT_COLUMNS, check_content_row),
    ):
        path = folder / name
        if not path.exists():
            problems.append(f"{path}: file not found")
            continue
        try:
            rows = _read(path, columns)
        except (ValueError, csv.Error) as error:
            problems.append(str(error))
            continue
        # Line numbers assume no line breaks inside titles, which is true for normal exports.
        for index, row in enumerate(rows):
            problems.extend(f"{path}: {p}" for p in check(row, index + 2))
    return problems


def _normalize_audience(row: dict) -> dict:
    return {
        "date": str(row["date"]).strip(),
        "platform": str(row["platform"]).strip().lower(),
        "audience": int(str(row["audience"]).strip()),
    }


def _normalize_content(row: dict) -> dict:
    return {
        "published_date": str(row["published_date"]).strip(),
        "platform": str(row["platform"]).strip().lower(),
        "content_type": str(row["content_type"]).strip().lower(),
        "title": str(row["title"]).strip(),
        "views": int(str(row["views"]).strip()),
    }


def upsert_audience(folder: str | Path, new_rows: list[dict]) -> int:
    """Adds or replaces audience rows, keyed by (date, platform). Returns how many were written."""
    for i, row in enumerate(new_rows):
        if problems := check_audience_row(row, i + 1):
            raise ValueError("; ".join(problems))
    path = Path(folder) / "audience.csv"
    by_key = {(r["date"], r["platform"].lower()): r for r in _read(path, AUDIENCE_COLUMNS)}
    for row in map(_normalize_audience, new_rows):
        by_key[(row["date"], row["platform"])] = row
    rows = sorted(by_key.values(), key=lambda r: (r["date"], PLATFORMS.index(r["platform"].lower())))
    _write(path, AUDIENCE_COLUMNS, rows)
    return len(new_rows)


def upsert_content(folder: str | Path, new_rows: list[dict]) -> int:
    """Adds or replaces content rows, keyed by (published_date, platform, title). Re-running a
    script updates view counts instead of adding duplicates."""
    for i, row in enumerate(new_rows):
        if problems := check_content_row(row, i + 1):
            raise ValueError("; ".join(problems))
    path = Path(folder) / "content.csv"
    key = lambda r: (r["published_date"], r["platform"].lower(), r["title"])  # noqa: E731
    by_key = {key(r): r for r in _read(path, CONTENT_COLUMNS)}
    for row in map(_normalize_content, new_rows):
        by_key[key(row)] = row
    rows = sorted(by_key.values(), key=lambda r: (r["published_date"], PLATFORMS.index(r["platform"].lower())))
    _write(path, CONTENT_COLUMNS, rows)
    return len(new_rows)


USAGE = __doc__.split("From Python:")[0].strip()


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "check":
        problems = check_folder(argv[1])
        if problems:
            print(f"Found {len(problems)} problem(s):", *problems[:20], sep="\n  ")
            return 1
        print(f"{argv[1]} looks good. Run: DATA_DIR={argv[1]} npm run dev")
        return 0
    if len(argv) == 5 and argv[0] == "add-audience":
        _, folder, day, platform, audience = argv
        upsert_audience(folder, [{"date": day, "platform": platform, "audience": audience}])
        print(f"Saved {platform} = {audience} on {day} in {folder}/audience.csv")
        return 0
    if len(argv) == 7 and argv[0] == "add-content":
        _, folder, day, platform, content_type, title, views = argv
        upsert_content(
            folder,
            [{"published_date": day, "platform": platform, "content_type": content_type, "title": title, "views": views}],
        )
        print(f'Saved "{title}" in {folder}/content.csv')
        return 0
    print(USAGE)
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except ValueError as error:
        print(f"Not saved: {error}")
        sys.exit(1)
