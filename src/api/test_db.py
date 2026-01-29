import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL:
    print("❌ .env missing")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def test():
    print("------------------------------------------------")
    print("🔍 DIAGNOSTIC CHECK")
    print("------------------------------------------------")

    # 1. Check Data Exists
    try:
        res = supabase.table("stock_ratings").select("count", count="exact").limit(1).execute()
        count = res.count
        print(f"✅ Database Connection: OK")
        print(f"📊 Total Rows in DB: {count}")
    except Exception as e:
        print(f"❌ Database Access Failed: {e}")
        return

    if count == 0:
        print("⚠️  Problem: Database is empty. Migration didn't work?")
        return

    # 2. Check RPC Function
    print("\nTesting RPC Function 'get_stocks_with_last_rating'...")
    try:
        # Try to call it with very basic params
        res = supabase.rpc("get_stocks_with_last_rating", {
            "target_market": None,
            "target_date": None,
            "search_term": None,
            "limit_val": 5,
            "offset_val": 0
        }).execute()
        
        print("✅ RPC Function: OK")
        print(f"📝 Returned {len(res.data)} rows from RPC")
        if len(res.data) > 0:
            print("SAMPLE ROW:", res.data[0])
    except Exception as e:
        print(f"❌ RPC FAILED: {e}")
        print("\n💡 SOLUTION: You probably didn't run the SQL script to create the function.")

if __name__ == "__main__":
    test()
