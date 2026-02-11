import os
import sys
from dotenv import load_dotenv

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../backend/src'))

from database import get_client

def check_elpw_history():
    print(">> 🔍 Checking full history for 'ELPW'...")
    client = get_client()

    try:
        # Fetch all records for ELPW
        res = client.table("stock_ratings").select("*").ilike("symbol", "ELPW%").order("fetched_date", desc=True).order("fetched_time", desc=True).limit(20).execute()
        
        if not res.data:
            print("❌ No data found for ELPW")
            return

        print(f"✅ Found {len(res.data)} records for ELPW:")
        for r in res.data:
            print(f"   Date: {r['fetched_date']} Time: {r['fetched_time']} | Rating: {r['technical_rating']} | ChangeDate: {r['rating_change_date']} | Price: {r['current_price']}")

        # Also check 'get_top_gainers' query logic manually
        # Note: We can't run raw SQL easily, but we can infer.

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_elpw_history()
