
import os
import csv
import logging
import argparse
from datetime import datetime
# from dotenv import load_dotenv # Removed dependency
from supabase import create_client, Client, ClientOptions

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Manual .env parsing
env_path = os.path.join(os.path.dirname(__file__), '../backend/.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("❌ Missing SUPABASE_URL or SUPABASE_KEY. Please check backend/.env")
    exit(1)

def export_table_to_csv(table_name: str, output_dir: str):
    """Fetches all data from a table and saves it to a CSV file."""
    # Increase timeout for large exports
    opts = ClientOptions(postgrest_client_timeout=60)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
    
    output_file = f"{output_dir}/{table_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    logger.info(f"🚀 Starting export of '{table_name}'...")
    
    try:
        # Get total count first
        total_rows = 0
        try:
             count_res = supabase.table(table_name).select("count", count="exact", head=True).execute()
             total_rows = count_res.count if count_res.count else 0
             logger.info(f"📊 Total rows to export for {table_name}: {total_rows}")
        except Exception as e:
             logger.warning(f"⚠️ Could not get count for {table_name} (likely too large): {e}. Proceeding with export anyway.")
             total_rows = 999999999 # Placeholder

        if total_rows == 0 and table_name != "stock_ratings": # Verify emptiness only if count succeeded or small table
             logger.warning(f"⚠️ Table '{table_name}' is empty. Nothing to export.")
             return

        if table_name == "stock_ratings":
             # Keyset Pagination for huge tables (prevents timeouts)
             last_id = 0
             logger.info("⚡ Using Keyset Pagination (ID-based) for stock_ratings...")
             
             with open(output_file, mode='w', newline='', encoding='utf-8') as f:
                writer = None
                rows_processed = 0
                
                while True:
                    # Fetch next batch where id > last_id
                    res = supabase.table(table_name)\
                        .select("id,symbol,market,name,current_price,technical_score,technical_rating,fetched_date,fetched_time,rating_change_date,daily_change_percent,previous_rating")\
                        .gt("id", last_id)\
                        .order("id", desc=False)\
                        .limit(2000)\
                        .execute() 
                        # Use limit() instead of range() for keyset
                    
                    if not res.data:
                        break
                        
                    if writer is None:
                        headers = res.data[0].keys()
                        writer = csv.DictWriter(f, fieldnames=headers)
                        writer.writeheader()
                    
                    writer.writerows(res.data)
                    
                    # Update cursor
                    last_id = res.data[-1]['id']
                    rows_processed += len(res.data)
                    
                    if rows_processed % 10000 == 0:
                        logger.info(f"   ... {rows_processed} rows processed (Last ID: {last_id})")

                logger.info(f"   ... Total {rows_processed} rows processed")

        else:
            # Standard Offset Pagination (for smaller tables)
            offset = 0
            with open(output_file, mode='w', newline='', encoding='utf-8') as f:
                writer = None
                
                while True: # loop until break
                    local_batch_size = 1000
                    res = supabase.table(table_name)\
                        .select("*")\
                        .order("id" if table_name != "latest_stock_ratings" else "symbol", desc=False)\
                        .range(offset, offset + local_batch_size - 1)\
                        .execute()
                    
                    if not res.data:
                        break
                        
                    if writer is None:
                        headers = res.data[0].keys()
                        writer = csv.DictWriter(f, fieldnames=headers)
                        writer.writeheader()
                    
                    writer.writerows(res.data)
                    offset += len(res.data)
                    
                    if offset % 5000 == 0:
                         logger.info(f"   ... {offset} rows processed")
                
                logger.info(f"   ... Total {offset} rows processed")

        logger.info(f"✅ Export complete! {table_name} saved to: {output_file}")
        
    except Exception as e:
        logger.error(f"❌ Error during export of {table_name}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export Supabase tables to CSV.")
    parser.add_argument("--dir", default="exports", help="Target directory for export (default: exports)")
    parser.add_argument("--table", default="all", help="Table name to export, or 'all', 'latest', 'history'")
    
    args = parser.parse_args()
    
    # Set and create export directory
    export_dir = args.dir
    if not os.path.exists(export_dir):
        try:
            os.makedirs(export_dir)
            logger.info(f"📂 Created directory: {export_dir}")
        except Exception as e:
            logger.warning(f"⚠️ Could not create folder: {e}. Using current directory.")
            export_dir = "."

    if args.table == 'all':
        # Export all key tables
        export_table_to_csv("latest_stock_ratings", export_dir)
        export_table_to_csv("stock_ratings", export_dir)
        export_table_to_csv("signal_returns", export_dir)
    elif args.table == 'latest':
         export_table_to_csv("latest_stock_ratings", export_dir)
    elif args.table == 'history':
         export_table_to_csv("stock_ratings", export_dir)
    else:
        export_table_to_csv(args.table, export_dir)
