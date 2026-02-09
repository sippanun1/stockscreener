
import os
import sys
import csv
from pathlib import Path
from supabase import create_client, Client

# ==========================================
# CONFIGURATION
# ==========================================

# OLD DB (Source)
OLD_DB_URL = "https://tadgftxgglxxlhhdzcww.supabase.co"
OLD_DB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZGdmdHhnZ2x4eGxoaGR6Y3d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MjMzMCwiZXhwIjoyMDg1MjM4MzMwfQ.zPKvczQYp9-al3ORlCMVnKE2R5hzDOjhgASs69YQyC8"

EXPORT_FILE = Path(__file__).parent / "old_db_export.csv"
BATCH_SIZE = 1000

# ==========================================
# CLIENT SETUP
# ==========================================

def get_old_client() -> Client:
    return create_client(OLD_DB_URL, OLD_DB_KEY)

def export_to_csv():
    print("\n📦 EXPORTING FROM OLD DB TO CSV...")
    print("="*60)
    
    client = get_old_client()
    
    # 1. Count
    try:
        count_res = client.table("stock_ratings").select("id", count="exact").limit(1).execute()
        total = count_res.count or 0
        print(f"Total Records to Export: {total:,}")
    except Exception as e:
        print(f"❌ Error connecting/counting: {e}")
        return

    offset = 0
    batch_num = 1
    
    # Open CSV file
    with open(EXPORT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
        writer = None
        
        while offset < total:
            # Fetch batch
            try:
                res = client.table("stock_ratings")\
                    .select("*")\
                    .range(offset, offset + BATCH_SIZE - 1)\
                    .execute()
                
                data = res.data
                if not data:
                    break
                
                # Initialize CSV writer with headers from first batch
                if writer is None:
                    headers = data[0].keys()
                    writer = csv.DictWriter(csvfile, fieldnames=headers)
                    writer.writeheader()
                
                # Write rows
                writer.writerows(data)
                
                sys.stdout.write(f"\rExported Batch {batch_num} | Total: {offset + len(data):,} records...")
                sys.stdout.flush()
                
                offset += len(data)
                batch_num += 1
                
            except Exception as e:
                print(f"\n❌ Error fetching batch {batch_num}: {e}")
                break
            
    print(f"\n✅ Export completed. File saved to: {EXPORT_FILE}")

if __name__ == "__main__":
    export_to_csv()
