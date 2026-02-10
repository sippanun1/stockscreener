
import os
import csv
import logging
import argparse
from typing import List, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(dotenv_path="../backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("❌ Missing SUPABASE_URL or SUPABASE_KEY. Please check backend/.env")
    exit(1)

def batch_upsert(supabase: Client, table_name: str, batch: List[Dict[Any, Any]], conflict_columns: str):
    """Helper to perform bulk upsert safely."""
    try:
        if conflict_columns:
            # Upsert if we have a conflict strategy
            response = supabase.table(table_name).upsert(batch, on_conflict=conflict_columns).execute()
        else:
            # Just Insert if no conflict info (e.g. signal_returns)
            response = supabase.table(table_name).insert(batch).execute()
            
        return len(response.data) if response.data else 0
    except Exception as e:
        logger.error(f"❌ Error during batch operation: {e}")
        return 0

def import_csv_to_table(csv_file: str, table_name: str, batch_size: int = 500):
    """Reads a CSV and upserts data in batches."""
    if not os.path.exists(csv_file):
        logger.error(f"❌ File not found: {csv_file}")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    logger.info(f"🚀 Starting import from '{csv_file}' to '{table_name}'...")
    
    total_imported = 0
    
    # Determine conflict columns based on table
    if table_name == "stock_ratings":
        # Note: Ideally this needs a UNIQUE index on these columns in DB to work as true UPSERT
        conflict_columns = "symbol, fetched_date, fetched_time, session_type"
    elif table_name == "signal_returns":
        # signal_returns usually has no unique constraint except ID.
        # If we remove ID, we can't UPSERT by ID. 
        # So we just INSERT (no conflict handling) to avoid errors.
        conflict_columns = None 
    else:
        # Default fallback
        conflict_columns = "id"
    
    with open(csv_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        batch = []
        
        for row in reader:
            # Clean data: convert numeric fields
            cleaned_row = {}
            for k, v in row.items():
                if v == "" or v is None:
                    cleaned_row[k] = None
                elif k in ["current_price", "open", "premarket_close", "premarket_open", 
                          "postmarket_close", "postmarket_open", "technical_score", 
                          "previous_price", "price_change", "change_percent"]:
                    try:
                        cleaned_row[k] = float(v)
                    except ValueError:
                        cleaned_row[k] = v
                else:
                    cleaned_row[k] = v
            
            # Remove 'id' column on import to avoid primary key conflicts 
            # unless the user is performing a literal database migration.
            if "id" in cleaned_row:
                del cleaned_row["id"]
                
            batch.append(cleaned_row)
            
            if len(batch) >= batch_size:
                logger.info(f"⏳ Upserting batch of {len(batch)}...")
                count = batch_upsert(supabase, table_name, batch, conflict_columns)
                total_imported += count
                batch = []
        
        # Last batch
        if batch:
            logger.info(f"⏳ Upserting final batch of {len(batch)}...")
            count = batch_upsert(supabase, table_name, batch, conflict_columns)
            total_imported += count

    logger.info(f"✅ Import complete! Total records upserted: {total_imported}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import CSV data to Supabase.")
    parser.add_argument("file", help="Path to the CSV file to import")
    parser.add_argument("--table", default="stock_ratings", help="Target table name (default: stock_ratings)")
    parser.add_argument("--batch", type=int, default=500, help="Batch size (default: 500)")
    
    args = parser.parse_args()
    import_csv_to_table(args.file, args.table, args.batch)
