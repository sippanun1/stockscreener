import sqlite3
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DB_PATH = "src/api/data/stocks.db"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY in .env")
    exit(1)

def migrate_data():
    print(f"🚀 Starting Migration from {DB_PATH} to Supabase...")
    
    # 1. Connect to Local SQLite
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"❌ Error opening SQLite DB: {e}")
        return

    # 2. Connect to Supabase
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"❌ Error connecting to Supabase: {e}")
        return

    # 3. Fetch Total Count
    cursor.execute("SELECT COUNT(*) FROM stock_ratings")
    total_rows = cursor.fetchone()[0]
    print(f"📊 Found {total_rows} records to migrate.")

    # 4. Migrate in Batches
    BATCH_SIZE = 1000
    offset = 0
    
    while offset < total_rows:
        try:
            # Fetch Batch
            cursor.execute(f"SELECT * FROM stock_ratings LIMIT {BATCH_SIZE} OFFSET {offset}")
            rows = cursor.fetchall()
            
            if not rows:
                break

            records = []
            for row in rows:
                # Map SQLite Row -> Supabase Dict
                # Note: SQLite stores dates as strings, Supabase needs standard formats.
                # Assuming schema matches closely.
                
                # Careful with NULLs and types
                record = {
                    "symbol": row["symbol"],
                    "market": row["market"],
                    "name": row["name"],
                    "current_price": row["current_price"],
                    # New columns might be missing in old SQLite rows, handle gracefully
                    "open": row["open"] if "open" in row.keys() else None,
                    "premarket_close": row["premarket_close"] if "premarket_close" in row.keys() else None,
                    "premarket_open": row["premarket_open"] if "premarket_open" in row.keys() else None,
                    "postmarket_close": row["postmarket_close"] if "postmarket_close" in row.keys() else None,
                    "postmarket_open": row["postmarket_open"] if "postmarket_open" in row.keys() else None,
                    
                    "technical_score": row["technical_score"],
                    "technical_rating": row["technical_rating"],
                    "fetched_date": row["fetched_date"],
                    "fetched_time": row["fetched_time"],
                    "session_type": row["session_type"] if "session_type" in row.keys() else "post_market"
                }
                
                # Clean up None values if needed, but Supabase handles NULL ok for nullable cols
                records.append(record)

            # Send to Supabase
            # Ignoring duplicates (on_conflict do nothing) or Upsert?
            # Safe to Upsert.
            supabase.table("stock_ratings").upsert(
                records, 
                on_conflict="symbol, fetched_date, fetched_time, session_type"
            ).execute()
            
            offset += len(rows)
            print(f"✅ Progress: {offset}/{total_rows} records migrated...")

        except Exception as e:
            print(f"⚠️ Error migrating batch {offset}: {e}")
            # Optional: continue or break? Let's break to fix.
            break

    print("🎉 Migration Complete!")
    conn.close()

if __name__ == "__main__":
    migrate_data()
