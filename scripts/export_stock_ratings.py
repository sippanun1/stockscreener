#!/usr/bin/env python3
"""
Export database tables from Supabase to chunked CSV files, then zip them.

NOTE: Supabase REST API returns max 1,000 rows per request and may timeout
      on COUNT queries for large tables. This script loops until empty response.

Usage:
    python scripts/export_stock_ratings.py

    # Resume from a specific offset for a table:
    python scripts/export_stock_ratings.py --resume stock_ratings 500000

Output:
    exports/stock_ratings_part_*.csv
    exports/latest_stock_ratings_part_*.csv
    exports/signal_returns_part_*.csv
    exports/database_export.zip
"""

import os
import csv
import sys
import time
import zipfile
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
ROWS_PER_FILE  = 100_000   # rows per output CSV file
FETCH_BATCH    = 1_000     # Supabase REST API max per request
OUTPUT_DIR     = Path("exports")
ZIP_NAME       = "database_export_20260218.zip"
TABLES         = ["stock_ratings", "latest_stock_ratings", "signal_returns"]
MAX_RETRIES    = 5         # retries on timeout/error
RETRY_DELAY    = 10        # seconds between retries (doubles each time)
# ─────────────────────────────────────────────────────────────────────────────


def fetch_with_retry(client, table: str, offset: int, batch: int, retries: int = MAX_RETRIES):
    """Fetch a batch with exponential backoff retry on timeout."""
    delay = RETRY_DELAY
    for attempt in range(1, retries + 1):
        try:
            res = (
                client.table(table)
                .select("*")
                .order("id")
                .range(offset, offset + batch - 1)
                .execute()
            )
            return res.data
        except Exception as e:
            if attempt == retries:
                raise
            print(f"\n  ⚠ Error at offset {offset:,} (attempt {attempt}/{retries}): {e}")
            print(f"    Retrying in {delay}s ...")
            time.sleep(delay)
            delay *= 2
    return []


def write_csv(path: Path, headers: list, rows: list) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def export_table(client, table_name: str, resume_offset: int = 0):
    print(f"--- Exporting '{table_name}' ---")
    headers: list         = []
    buffer: list          = []
    offset                = resume_offset
    part                  = (resume_offset // ROWS_PER_FILE) + 1
    total_fetched         = resume_offset
    csv_files: list[Path] = []

    while True:
        batch = fetch_with_retry(client, table_name, offset, FETCH_BATCH)
        if not batch:
            break

        if not headers:
            headers = list(batch[0].keys())

        buffer.extend(batch)
        offset        += len(batch)
        total_fetched += len(batch)

        print(f"  Fetched {total_fetched:,} rows total ...", end="\r")

        while len(buffer) >= ROWS_PER_FILE:
            chunk    = buffer[:ROWS_PER_FILE]
            filename = OUTPUT_DIR / f"{table_name}_part_{part:03d}.csv"
            write_csv(filename, headers, chunk)
            csv_files.append(filename)
            print(f"\n  ✓ Wrote {len(chunk):,} rows → {filename}")
            buffer = buffer[ROWS_PER_FILE:]
            part  += 1

    if buffer:
        filename = OUTPUT_DIR / f"{table_name}_part_{part:03d}.csv"
        write_csv(filename, headers, buffer)
        csv_files.append(filename)
        print(f"\n  ✓ Wrote {len(buffer):,} rows → {filename}")

    print(f"Finished '{table_name}'. Total rows: {total_fetched:,}\n")
    return csv_files


def main():
    resume_table  = None
    resume_offset = 0

    if "--resume" in sys.argv:
        idx = sys.argv.index("--resume")
        resume_table  = sys.argv[idx + 1]
        resume_offset = int(sys.argv[idx + 2])
        print(f"Resuming '{resume_table}' from offset {resume_offset:,}\n")

    load_dotenv(dotenv_path=Path(__file__).parent.parent / "backend" / ".env")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")

    client = create_client(url, key)
    OUTPUT_DIR.mkdir(exist_ok=True)

    all_csv_files = []
    
    # Identify tables to process
    tables_to_process = TABLES
    if resume_table:
        # Start from the resume table
        if resume_table in TABLES:
            tables_to_process = TABLES[TABLES.index(resume_table):]
        else:
            print(f"Error: Table '{resume_table}' not found in configuration.")
            return

    for table in tables_to_process:
        curr_resume = resume_offset if table == resume_table else 0
        all_csv_files.extend(export_table(client, table, curr_resume))

    # Also include existing part files for tables not processed (if resumes)
    if resume_table:
         for p in OUTPUT_DIR.glob("*_part_*.csv"):
             if p not in all_csv_files:
                 all_csv_files.append(p)

    zip_path = OUTPUT_DIR / ZIP_NAME
    print(f"\nZipping {len(all_csv_files)} file(s) → {zip_path} ...")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for csv_file in sorted(all_csv_files):
            zf.write(csv_file, arcname=csv_file.name)
            print(f"  + {csv_file.name}")

    zip_size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"\n✅ Done! ZIP: {zip_path}  ({zip_size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
