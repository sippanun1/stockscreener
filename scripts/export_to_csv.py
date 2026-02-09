
import os
import csv
import logging
from datetime import datetime
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

def export_table_to_csv(table_name: str, output_file: str):
    """Fetches all data from a table and saves it to a CSV file."""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    logger.info(f"🚀 Starting export of '{table_name}'...")
    
    # Get total count first
    count_res = supabase.table(table_name).select("id", count="exact").limit(1).execute()
    total_rows = count_res.count if count_res.count else 0
    logger.info(f"📊 Total rows to export: {total_rows}")
    
    if total_rows == 0:
        logger.warning(f"⚠️ Table '{table_name}' is empty. Nothing to export.")
        return

    # Use batching to fetch all data
    batch_size = 1000
    offset = 0
    
    with open(output_file, mode='w', newline='', encoding='utf-8') as f:
        writer = None
        
        while offset < total_rows:
            logger.info(f"⏳ Fetching rows {offset} to {min(offset + batch_size, total_rows)}...")
            
            res = supabase.table(table_name).select("*").order("id", desc=False).range(offset, offset + batch_size - 1).execute()
            
            if not res.data:
                break
                
            if writer is None:
                # Initialize CSV writer with headers from the first row
                headers = res.data[0].keys()
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
            
            writer.writerows(res.data)
            offset += len(res.data)
    
    logger.info(f"✅ Export complete! Data saved to: {output_file}")

if __name__ == "__main__":
    # Ensure export directory exists
    export_dir = "exports"
    if not os.path.exists(export_dir):
        os.makedirs(export_dir)
        
    filename = f"{export_dir}/stock_ratings_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    export_table_to_csv("stock_ratings", filename)
