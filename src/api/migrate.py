import json
import os
import glob
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DATA_DIR = "data"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing credentials")
    exit(1)

def migrate_json():
    print("🚀 Starting Migration from JSON Backups...")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Priority: ALL_MARKETS.json (Recent buffer) -> Then market specific files
    # Actually, let's just grab ALL .json files that look like data
    files = glob.glob(f"{DATA_DIR}/*.json")
    print(f"📂 Found {len(files)} JSON files: {[os.path.basename(f) for f in files]}")
    
    for file_path in files:
        file_name = os.path.basename(file_path)
        print(f"\nProcessing {file_name}...")
        
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                
            if not isinstance(data, list):
                print(f"⚠️ Skipping {file_name}: Not a list of stocks")
                continue
                
            print(f"📊 Found {len(data)} records in {file_name}")
            
            # Batch Upsert
            BATCH_SIZE = 500
            for i in range(0, len(data), BATCH_SIZE):
                batch = data[i:i+BATCH_SIZE]
                records = []
                
                for item in batch:
                    # Clean/Map fields
                    # JSON usually has "Technical_Rating" vs "technical_rating" key diffs
                    # We map loosely
                    
                    def get(k): return item.get(k)
                    
                    # Try to find symbol
                    symbol = get("symbol") or get("name") # Some old formats might vary?
                    if not symbol: continue
                    
                    fetched_at_str = get("fetched_at")
                    f_date = datetime.now().strftime("%Y-%m-%d")
                    f_time = "00:00:00"
                    
                    if fetched_at_str:
                        try:
                            parts = fetched_at_str.split(" ")
                            f_date = parts[0]
                            if len(parts) > 1: f_time = parts[1]
                        except: pass
                    
                    record = {
                        "symbol": symbol,
                        "market": get("market") or (symbol.split(":")[0] if ":" in symbol else "US"),
                        "name": get("name") or symbol,
                        "current_price": get("current_price"),
                        "open": get("open"),
                        "premarket_close": get("premarket_close"),
                        "premarket_open": get("premarket_open"),
                        "postmarket_close": get("postmarket_close"),
                        "postmarket_open": get("postmarket_open"),
                        "technical_score": get("Technical_Score"),
                        "technical_rating": get("Technical_Rating") or get("technical_rating"),
                        "fetched_date": f_date,
                        "fetched_time": f_time,
                        "session_type": "post_market" # Defaulting for JSONs
                    }
                    records.append(record)
                
                if records:
                    supabase.table("stock_ratings").upsert(
                        records,
                        on_conflict="symbol, fetched_date, fetched_time, session_type"
                    ).execute()
                    print(f"   Saved {len(records)}...")
                    
        except Exception as e:
            print(f"❌ Error processing {file_name}: {e}")

    print("🎉 Migration Complete!")

if __name__ == "__main__":
    migrate_json()
