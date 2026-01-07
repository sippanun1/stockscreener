"""
Migration Script: JSON to SQLite
=================================
One-time script to import existing JSON data files into SQLite database.
This populates historical data for testing the 'last different rating' feature.

Usage:
    cd src/api
    python migrate_json_to_sqlite.py
"""

import json
from pathlib import Path
from datetime import datetime
import database

DATA_DIR = Path(__file__).parent / "data"


def migrate_json_files():
    """Migrate all JSON files in the data directory to SQLite."""
    
    print("=" * 50)
    print(">> Starting JSON to SQLite Migration")
    print("=" * 50)
    
    # Initialize database
    database.init_db()
    
    # Find all JSON files
    json_files = list(DATA_DIR.glob("*.json"))
    print(f">> Found {len(json_files)} JSON files")
    
    # Sort by filename to process in chronological order
    json_files.sort()
    
    total_imported = 0
    
    for json_file in json_files:
        filename = json_file.name
        
        # Skip ALL_MARKETS files - we'll use individual market files
        # or process only ALL_MARKETS files for faster migration
        if not filename.startswith("ALL_MARKETS"):
            continue
        
        # Extract date from filename (e.g., ALL_MARKETS_2026-01-06.json)
        try:
            # Try to extract date from filename
            date_part = filename.replace("ALL_MARKETS_", "").replace(".json", "")
            # Validate it's a date
            datetime.strptime(date_part, "%Y-%m-%d")
            file_date = date_part
        except ValueError:
            # If no date in filename, use file modification time
            mtime = json_file.stat().st_mtime
            file_date = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
        
        print(f"\n>> Processing: {filename} (date: {file_date})")
        
        try:
            with open(json_file, 'r') as f:
                data = json.load(f)
            
            if isinstance(data, list) and len(data) > 0:
                result = database.save_daily_stocks(data, file_date)
                total_imported += result["inserted"] + result["updated"]
                print(f"   Imported {len(data)} records")
            else:
                print(f"   Skipped (empty or invalid format)")
                
        except Exception as e:
            print(f"   Error: {e}")
    
    print("\n" + "=" * 50)
    print(f">> Migration Complete!")
    print(f">> Total records imported: {total_imported}")
    
    # Print database stats
    stats = database.get_stats()
    print(f"\n>> Database Stats:")
    print(f"   Total rows: {stats['total_rows']}")
    print(f"   Unique stocks: {stats['unique_stocks']}")
    print(f"   Total days: {stats['total_days']}")
    if stats['date_range']['oldest']:
        print(f"   Date range: {stats['date_range']['oldest']} to {stats['date_range']['newest']}")
    print("=" * 50)


def migrate_single_file(filepath: str, date: str = None):
    """Migrate a single JSON file to SQLite."""
    
    json_file = Path(filepath)
    
    if not json_file.exists():
        print(f">> File not found: {filepath}")
        return
    
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")
    
    print(f">> Migrating: {json_file.name} (date: {date})")
    
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    database.init_db()
    result = database.save_daily_stocks(data, date)
    
    print(f">> Done! Inserted: {result['inserted']}, Updated: {result['updated']}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Migrate specific file
        filepath = sys.argv[1]
        date = sys.argv[2] if len(sys.argv) > 2 else None
        migrate_single_file(filepath, date)
    else:
        # Migrate all files
        migrate_json_files()
