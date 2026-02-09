"""
Database Migration Script (Optimized)
=====================================
Migrate data from Old Supabase (Hardcoded) to New Supabase (.env).

Features:
- Auto-detects Old DB credentials (hardcoded for convenience)
- Uses .env for New DB credentials
- API-based Upsert (No psycopg2 required)
- Handles duplicates gracefully
- Progress bars and detailed stats

Usage:
    python src/migrate_to_postgres.py --full     # Full wipe & migrate
    python src/migrate_to_postgres.py --export   # Export only
    python src/migrate_to_postgres.py --import   # Import only
    python src/migrate_to_postgres.py --clean    # Wipe New DB only
"""

import os
import json
import sys
import argparse
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
from dotenv import load_dotenv

# Load environment variables (For NEW DB)
load_dotenv()

# ==========================================
# CONFIGURATION
# ==========================================

# OLD DB (Source)
OLD_DB_URL = "https://tadgftxgglxxlhhdzcww.supabase.co"
OLD_DB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZGdmdHhnZ2x4eGxoaGR6Y3d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MjMzMCwiZXhwIjoyMDg1MjM4MzMwfQ.zPKvczQYp9-al3ORlCMVnKE2R5hzDOjhgASs69YQyC8"

# NEW DB (Destination) - From .env
NEW_DB_URL = os.getenv("SUPABASE_URL")
NEW_DB_KEY = os.getenv("SUPABASE_KEY")

EXPORT_DIR = Path(__file__).parent / "data" / "export"
BATCH_SIZE = 250

# ==========================================
# CLIENT SETUP
# ==========================================

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Error: 'supabase' library not installed. Run: pip install supabase")
    sys.exit(1)

def get_old_client() -> Client:
    return create_client(OLD_DB_URL, OLD_DB_KEY)

def get_new_client() -> Client:
    if not NEW_DB_URL or not NEW_DB_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in .env")
        sys.exit(1)
    return create_client(NEW_DB_URL, NEW_DB_KEY)


class DataMigrator:
    def __init__(self):
        self.export_dir = EXPORT_DIR
        self.export_dir.mkdir(parents=True, exist_ok=True)
        
    def clean_new_db(self):
        """Wipe all data from New DB stock_ratings table."""
        print("\n🧹 CLEANING NEW DATABASE...")
        print("="*60)
        
        client = get_new_client()
        
        # Count before
        count_res = client.table("stock_ratings").select("id", count="exact").limit(1).execute()
        print(f"Records before cleaning: {count_res.count:,}")
        
        if count_res.count == 0:
            print("Already empty.")
            return

        print("Deleting records (this may take time)...")
        # Since we can't TRUNCATE via API easily without RPC, we delete in batches or use a loop
        # Optimally, user should use Table Editor -> Delete All, but via script:
        
        chunk_size = 1000
        deleted_count = 0
        
        while True:
            # Delete simple condition: id > 0
            res = client.table("stock_ratings").select("id").limit(chunk_size).execute()
            ids = [r['id'] for r in res.data]
            
            if not ids:
                break
                
            client.table("stock_ratings").delete().in_("id", ids).execute()
            deleted_count += len(ids)
            sys.stdout.write(f"\rDeleted {deleted_count:,} records...")
            sys.stdout.flush()
            
        print(f"\n✅ Cleaning completed.")

    def export_data(self):
        """Export from Old DB to JSON."""
        print("\n📦 EXPORTING FROM OLD DB...")
        print("="*60)
        
        client = get_old_client()
        
        # 1. Count
        count_res = client.table("stock_ratings").select("id", count="exact").limit(1).execute()
        total = count_res.count or 0
        print(f"Total Source Records: {total:,}")
        
        offset = 0
        batch_num = 1
        
        while offset < total:
            # Fetch
            res = client.table("stock_ratings")\
                .select("*")\
                .range(offset, offset + BATCH_SIZE - 1)\
                .execute()
            
            data = res.data
            if not data:
                break
                
            # Save
            filename = self.export_dir / f"batch_{batch_num:04d}.json"
            with open(filename, 'w') as f:
                json.dump(data, f, default=str)
                
            sys.stdout.write(f"\rExported Batch {batch_num} ({len(data)} records)...")
            sys.stdout.flush()
            
            offset += len(data)
            batch_num += 1
            
        print(f"\n✅ Export completed. Files in {self.export_dir}")

    def import_data(self):
        """Import JSON to New DB."""
        print("\n📥 IMPORTING TO NEW DB...")
        print("="*60)
        
        client = get_new_client()
        files = sorted(list(self.export_dir.glob("batch_*.json")))
        
        if not files:
            print("❌ No export files found.")
            return

        print(f"Found {len(files)} batch files.")
        
        total_imported = 0
        errors = 0
        
        for i, fpath in enumerate(files):
            try:
                with open(fpath, 'r') as f:
                    batch = json.load(f)
                
                if not batch:
                    continue
                
                # Clean batch: Remove 'id' to let New DB generate it (or keep valid bigints?)
                # Ideally remove 'id' to avoid conflicts if IDs are serial
                # BUT ensure we keep unique keys.
                # Let's remove 'id' to be safe and let SERIAL process it.
                clean_batch = []
                for row in batch:
                    if 'id' in row:
                        del row['id']
                    clean_batch.append(row)
                
                # Upsert to handle duplicates
                # on_conflict specified to merging on unique keys
                client.table("stock_ratings").upsert(
                    clean_batch, 
                    on_conflict="symbol,fetched_date,fetched_time,session_type",
                    ignore_duplicates=False  # Update if exists
                ).execute()
                
                total_imported += len(clean_batch)
                
                sys.stdout.write(f"\rProcess: {(i+1)/len(files)*100:.1f}% | Imported: {total_imported:,} | Errors: {errors}")
                sys.stdout.flush()
                
            except Exception as e:
                errors += 1
                # Save failed batch name?
                print(f"\n❌ Error in {fpath.name}: {str(e)[:100]}")
                
        print(f"\n✅ Import Process Finished.")
        print(f"Total Imported (Request): {total_imported:,}")
        
    def cleanup_files(self):
        print("\n🧹 deleting export files...")
        for f in self.export_dir.glob("batch_*.json"):
            f.unlink()
        print("Done.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--full", action="store_true", help="Clean, Export, Import, Cleanup")
    parser.add_argument("--export", action="store_true")
    parser.add_argument("--import", dest="import_only", action="store_true") # 'import' is keyword
    parser.add_argument("--clean", action="store_true")
    
    args = parser.parse_args()
    
    migrator = DataMigrator()
    
    if args.full:
        migrator.clean_new_db()
        migrator.export_data()
        migrator.import_data()
        migrator.cleanup_files()
    else:
        if args.clean:
            migrator.clean_new_db()
        if args.export:
            migrator.export_data()
        if args.import_only:
            migrator.import_data()

if __name__ == "__main__":
    main()
