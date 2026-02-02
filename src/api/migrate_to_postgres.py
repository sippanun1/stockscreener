"""
Database Migration Script
=========================
Migrate data from Supabase to custom PostgreSQL database.

Usage:
    python migrate_to_postgres.py --export     # Export data from Supabase
    python migrate_to_postgres.py --import     # Import data to PostgreSQL
    python migrate_to_postgres.py --migrate    # Export and import in one step
    python migrate_to_postgres.py --verify     # Verify data integrity after migration
"""

import os
import json
import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import time

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Try importing both database clients
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️  Warning: Supabase client not available. Install with: pip install supabase")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, execute_batch
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    print("⚠️  Warning: psycopg2 not available. Install with: pip install psycopg2-binary")


# Configuration
EXPORT_DIR = Path(__file__).parent / "data" / "export"
BATCH_SIZE = 1000  # Number of records to process at once


class DatabaseMigrator:
    """Handles migration between Supabase and PostgreSQL."""
    
    def __init__(self):
        self.supabase_client = None
        self.pg_connection = None
        self.export_dir = EXPORT_DIR
        self.export_dir.mkdir(parents=True, exist_ok=True)
        
    def connect_supabase(self):
        """Connect to Supabase database."""
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase client not installed")
            
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env file")
            
        self.supabase_client = create_client(supabase_url, supabase_key)
        print("✅ Connected to Supabase")
        
    def connect_postgres(self):
        """Connect to PostgreSQL database."""
        if not PSYCOPG2_AVAILABLE:
            raise ImportError("psycopg2 not installed")
            
        try:
            self.pg_connection = psycopg2.connect(
                host=os.getenv("DB_HOST", "localhost"),
                port=os.getenv("DB_PORT", "5432"),
                database=os.getenv("DB_NAME", "stockscreener"),
                user=os.getenv("DB_USER", "stockuser"),
                password=os.getenv("DB_PASSWORD")
            )
            print("✅ Connected to PostgreSQL")
        except Exception as e:
            raise ConnectionError(f"Failed to connect to PostgreSQL: {e}")
    
    def export_from_supabase(self) -> Dict[str, int]:
        """Export all data from Supabase to JSON files."""
        print("\n" + "="*60)
        print("📦 EXPORTING DATA FROM SUPABASE")
        print("="*60 + "\n")
        
        self.connect_supabase()
        
        stats = {
            "total_records": 0,
            "exported_batches": 0,
            "markets": {}
        }
        
        # Get total count
        print("📊 Counting total records...")
        count_response = self.supabase_client.table("stock_ratings").select("id", count="exact").limit(1).execute()
        stats["total_records"] = count_response.count or 0
        print(f"Total records to export: {stats['total_records']:,}\n")
        
        # Export in batches
        offset = 0
        batch_num = 1
        
        while True:
            print(f"Fetching batch {batch_num} (records {offset+1}-{offset+BATCH_SIZE})...")
            
            # Fetch batch
            response = self.supabase_client.table("stock_ratings")\
                .select("*")\
                .range(offset, offset + BATCH_SIZE - 1)\
                .execute()
            
            if not response.data:
                break
            
            batch_data = response.data
            
            # Track markets
            for record in batch_data:
                market = record.get("market", "UNKNOWN")
                stats["markets"][market] = stats["markets"].get(market, 0) + 1
            
            # Save batch to file
            filename = self.export_dir / f"batch_{batch_num:04d}.json"
            with open(filename, 'w') as f:
                json.dump(batch_data, f, indent=2, default=str)
            
            print(f"✅ Saved {len(batch_data)} records to {filename.name}")
            
            stats["exported_batches"] += 1
            offset += BATCH_SIZE
            batch_num += 1
            
            if len(batch_data) < BATCH_SIZE:
                break
            
            # Small delay to avoid rate limiting
            time.sleep(0.1)
        
        # Save metadata
        metadata = {
            "export_date": datetime.now().isoformat(),
            "total_records": stats["total_records"],
            "exported_batches": stats["exported_batches"],
            "markets": stats["markets"],
            "batch_size": BATCH_SIZE
        }
        
        metadata_file = self.export_dir / "export_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n{'='*60}")
        print("✅ EXPORT COMPLETED")
        print(f"{'='*60}")
        print(f"Total records exported: {stats['total_records']:,}")
        print(f"Number of batches: {stats['exported_batches']}")
        print(f"Export directory: {self.export_dir}")
        print(f"\nMarkets breakdown:")
        for market, count in sorted(stats["markets"].items()):
            print(f"  - {market}: {count:,} records")
        
        return stats
    
    def import_to_postgres(self) -> Dict[str, int]:
        """Import data from JSON files to PostgreSQL."""
        print("\n" + "="*60)
        print("📥 IMPORTING DATA TO POSTGRESQL")
        print("="*60 + "\n")
        
        self.connect_postgres()
        
        # Check if export files exist
        batch_files = sorted(self.export_dir.glob("batch_*.json"))
        if not batch_files:
            raise FileNotFoundError(f"No export files found in {self.export_dir}. Run --export first.")
        
        print(f"Found {len(batch_files)} batch files to import\n")
        
        stats = {
            "total_imported": 0,
            "failed": 0,
            "batches_processed": 0
        }
        
        cursor = self.pg_connection.cursor()
        
        for batch_file in batch_files:
            print(f"Processing {batch_file.name}...")
            
            try:
                with open(batch_file, 'r') as f:
                    records = json.load(f)
                
                if not records:
                    continue
                
                # Prepare INSERT statement
                insert_query = """
                    INSERT INTO stock_ratings (
                        symbol, market, name, current_price, open,
                        premarket_close, premarket_open, postmarket_close, postmarket_open,
                        technical_score, technical_rating, rating_change_date,
                        fetched_date, fetched_time, session_type
                    ) VALUES (
                        %(symbol)s, %(market)s, %(name)s, %(current_price)s, %(open)s,
                        %(premarket_close)s, %(premarket_open)s, %(postmarket_close)s, %(postmarket_open)s,
                        %(technical_score)s, %(technical_rating)s, %(rating_change_date)s,
                        %(fetched_date)s, %(fetched_time)s, %(session_type)s
                    )
                    ON CONFLICT (symbol, fetched_date, fetched_time, session_type) 
                    DO UPDATE SET
                        current_price = EXCLUDED.current_price,
                        technical_rating = EXCLUDED.technical_rating,
                        technical_score = EXCLUDED.technical_score
                """
                
                # Use execute_batch for better performance
                execute_batch(cursor, insert_query, records, page_size=100)
                self.pg_connection.commit()
                
                stats["total_imported"] += len(records)
                stats["batches_processed"] += 1
                print(f"✅ Imported {len(records)} records")
                
            except Exception as e:
                print(f"❌ Error processing {batch_file.name}: {e}")
                self.pg_connection.rollback()
                stats["failed"] += 1
        
        cursor.close()
        
        print(f"\n{'='*60}")
        print("✅ IMPORT COMPLETED")
        print(f"{'='*60}")
        print(f"Total records imported: {stats['total_imported']:,}")
        print(f"Batches processed: {stats['batches_processed']}/{len(batch_files)}")
        if stats["failed"] > 0:
            print(f"⚠️  Failed batches: {stats['failed']}")
        
        return stats
    
    def verify_migration(self):
        """Verify data integrity after migration."""
        print("\n" + "="*60)
        print("🔍 VERIFYING MIGRATION")
        print("="*60 + "\n")
        
        # Load export metadata
        metadata_file = self.export_dir / "export_metadata.json"
        if not metadata_file.exists():
            print("❌ Export metadata not found. Run --export first.")
            return
        
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        expected_count = metadata["total_records"]
        expected_markets = metadata["markets"]
        
        # Connect to PostgreSQL and verify
        self.connect_postgres()
        cursor = self.pg_connection.cursor(cursor_factory=RealDictCursor)
        
        # Check total count
        cursor.execute("SELECT COUNT(*) as count FROM stock_ratings")
        actual_count = cursor.fetchone()["count"]
        
        print(f"Expected records: {expected_count:,}")
        print(f"Actual records:   {actual_count:,}")
        
        if actual_count == expected_count:
            print("✅ Record count matches!\n")
        else:
            diff = actual_count - expected_count
            print(f"⚠️  Difference: {diff:+,} records\n")
        
        # Check markets breakdown
        cursor.execute("""
            SELECT market, COUNT(*) as count 
            FROM stock_ratings 
            GROUP BY market 
            ORDER BY market
        """)
        actual_markets = {row["market"]: row["count"] for row in cursor.fetchall()}
        
        print("Markets comparison:")
        print(f"{'Market':<10} {'Expected':<12} {'Actual':<12} {'Status'}")
        print("-" * 50)
        
        all_markets = set(expected_markets.keys()) | set(actual_markets.keys())
        all_match = True
        
        for market in sorted(all_markets):
            exp = expected_markets.get(market, 0)
            act = actual_markets.get(market, 0)
            status = "✅" if exp == act else "⚠️"
            if exp != act:
                all_match = False
            print(f"{market:<10} {exp:<12,} {act:<12,} {status}")
        
        # Check date range
        cursor.execute("""
            SELECT 
                MIN(fetched_date) as min_date,
                MAX(fetched_date) as max_date
            FROM stock_ratings
        """)
        date_range = cursor.fetchone()
        
        print(f"\nDate range: {date_range['min_date']} to {date_range['max_date']}")
        
        # Check for duplicate records
        cursor.execute("""
            SELECT symbol, fetched_date, fetched_time, session_type, COUNT(*) as count
            FROM stock_ratings
            GROUP BY symbol, fetched_date, fetched_time, session_type
            HAVING COUNT(*) > 1
        """)
        duplicates = cursor.fetchall()
        
        if duplicates:
            print(f"\n⚠️  Found {len(duplicates)} duplicate records:")
            for dup in duplicates[:5]:
                print(f"   {dup['symbol']} on {dup['fetched_date']} at {dup['fetched_time']} ({dup['count']} copies)")
        else:
            print("\n✅ No duplicate records found")
        
        cursor.close()
        
        print(f"\n{'='*60}")
        if all_match and actual_count == expected_count and not duplicates:
            print("✅ MIGRATION VERIFICATION PASSED")
        else:
            print("⚠️  MIGRATION VERIFICATION COMPLETED WITH WARNINGS")
        print(f"{'='*60}\n")
    
    def cleanup_export_files(self):
        """Delete export files after successful migration."""
        print("\n🧹 Cleaning up export files...")
        
        batch_files = list(self.export_dir.glob("batch_*.json"))
        for file in batch_files:
            file.unlink()
            print(f"Deleted {file.name}")
        
        # Keep metadata for reference
        print(f"\nDeleted {len(batch_files)} batch files")
        print("Kept export_metadata.json for reference")
    
    def close(self):
        """Close database connections."""
        if self.pg_connection:
            self.pg_connection.close()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate stock screener data from Supabase to PostgreSQL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python migrate_to_postgres.py --export          Export data from Supabase
  python migrate_to_postgres.py --import          Import data to PostgreSQL
  python migrate_to_postgres.py --migrate         Full migration (export + import)
  python migrate_to_postgres.py --verify          Verify migration integrity
  python migrate_to_postgres.py --migrate --cleanup  Migrate and cleanup export files
        """
    )
    
    parser.add_argument("--export", action="store_true", help="Export data from Supabase")
    parser.add_argument("--import", action="store_true", help="Import data to PostgreSQL")
    parser.add_argument("--migrate", action="store_true", help="Full migration (export + import)")
    parser.add_argument("--verify", action="store_true", help="Verify migration integrity")
    parser.add_argument("--cleanup", action="store_true", help="Delete export files after successful migration")
    
    args = parser.parse_args()
    
    # Show help if no arguments
    if not any([args.export, args.migrate, args.verify]) and not getattr(args, 'import'):
        parser.print_help()
        sys.exit(0)
    
    migrator = DatabaseMigrator()
    
    try:
        if args.migrate:
            # Full migration
            print("🚀 Starting full migration process...\n")
            migrator.export_from_supabase()
            migrator.import_to_postgres()
            migrator.verify_migration()
            
            if args.cleanup:
                migrator.cleanup_export_files()
            
            print("\n🎉 Migration completed successfully!")
            
        else:
            # Individual steps
            if args.export:
                migrator.export_from_supabase()
            
            if getattr(args, 'import'):
                migrator.import_to_postgres()
            
            if args.verify:
                migrator.verify_migration()
                
            if args.cleanup and (args.export or getattr(args, 'import')):
                migrator.cleanup_export_files()
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        migrator.close()


if __name__ == "__main__":
    main()
