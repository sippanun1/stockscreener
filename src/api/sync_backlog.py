"""
Sync Backlog Data from JSON to SQLite
======================================
This script reads existing JSON files and imports them into SQLite database.
Use this to sync historical data that was scraped but not yet in the database.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path to import database module
sys.path.insert(0, str(Path(__file__).parent))
import database


def sync_json_to_sqlite(json_file_path, date_str):
    """
    Read a JSON file and import all records into SQLite for a specific date.
    
    Args:
        json_file_path: Path to the JSON file
        date_str: Date string in YYYY-MM-DD format
    """
    print(f"\n>> Reading {json_file_path}...")
    
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    
    print(f">> Found {len(data)} total records")
    
    # Filter records for the specific date
    filtered_data = []
    for record in data:
        fetched_at = record.get('fetched_at', '')
        if fetched_at.startswith(date_str):
            filtered_data.append(record)
    
    print(f">> Filtered to {len(filtered_data)} records for date {date_str}")
    
    if not filtered_data:
        print(f">> No records found for date {date_str}")
        return 0
    
    # Save to database
    try:
        database.save_daily_stocks(filtered_data, date_str)
        print(f">> ✅ Successfully saved {len(filtered_data)} records to SQLite")
        return len(filtered_data)
    except Exception as e:
        print(f">> ❌ Error saving to SQLite: {e}")
        return 0


def main():
    """Sync backlog data from JSON files to SQLite."""
    
    print("="*60)
    print("Syncing Backlog Data: JSON → SQLite")
    print("="*60)
    
    # Path to ALL_MARKETS.json
    data_dir = Path(__file__).parent / "data"
    json_file = data_dir / "ALL_MARKETS.json"
    
    if not json_file.exists():
        print(f">> Error: {json_file} not found")
        return
    
    # Dates to sync (modify as needed)
    dates_to_sync = [
        "2026-01-06",
        "2026-01-07",
        "2026-01-08",  # Today if available
    ]
    
    total_synced = 0
    
    for date_str in dates_to_sync:
        count = sync_json_to_sqlite(json_file, date_str)
        total_synced += count
    
    print("\n" + "="*60)
    print(f">> DONE: Synced {total_synced} total records")
    print("="*60)
    
    # Verify database
    print("\n>> Verifying database...")
    import sqlite3
    conn = sqlite3.connect(data_dir / "stocks.db")
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT fetched_date, COUNT(*) as count
        FROM stock_ratings
        GROUP BY fetched_date
        ORDER BY fetched_date DESC
        LIMIT 5
    """)
    
    print("\nRecent dates in database:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]:,} records")
    
    conn.close()


if __name__ == "__main__":
    main()
