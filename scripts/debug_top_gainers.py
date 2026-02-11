#!/usr/bin/env python3
"""
Debug get_top_gainers step by step
"""

import os
import sys
from supabase import create_client

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    print("❌ Set SUPABASE_URL and SUPABASE_KEY first!")
    sys.exit(1)

client = create_client(supabase_url, supabase_key)

print("=" * 60)
print("Debugging get_top_gainers")
print("=" * 60)

# Test 1: Check if get_summary works
print("\n1️⃣  Testing get_summary:")
try:
    result = client.rpc("get_summary", {
        "target_market": None,
        "target_date": None
    }).execute()
    
    if result.data:
        data = result.data[0] if isinstance(result.data, list) else result.data
        print(f"✅ Success!")
        print(f"   Total Positive: {data.get('total_positive', 0)}")
        print(f"   Total Negative: {data.get('total_negative', 0)}")
        print(f"   Strong Buy: {data.get('strong_buy', 0)}")
        print(f"   Buy: {data.get('buy', 0)}")
    else:
        print("❌ No data returned!")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 2: Check if get_top_gainers works
print("\n2️⃣  Testing get_top_gainers:")
try:
    result = client.rpc("get_top_gainers", {
        "target_market": None,
        "target_date": None,
        "limit_val": 3
    }).execute()
    
    if result.data:
        print(f"✅ Success! Found {len(result.data)} stocks")
        for i, stock in enumerate(result.data, 1):
            print(f"   {i}. {stock['symbol']:15} {stock['market']:8} +{stock['change_percent']:6.2f}%")
    else:
        print("❌ No data returned! (Empty array)")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 3: Check raw stock_ratings table
print("\n3️⃣  Testing raw stock_ratings table:")
try:
    result = client.table("stock_ratings").select("symbol, market, current_price, change_percent, fetched_date").order("change_percent", desc=True).limit(5).execute()
    
    if result.data:
        print(f"✅ Found {len(result.data)} stocks with highest change_percent:")
        for i, stock in enumerate(result.data, 1):
            cp = stock.get('change_percent', 0) or 0
            print(f"   {i}. {stock['symbol']:15} {stock['market']:8} {cp:6.2f}% (date: {stock.get('fetched_date', 'N/A')})")
    else:
        print("❌ No data in stock_ratings table!")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 4: Check if there are any stocks with change_percent > 0
print("\n4️⃣  Checking stocks with change_percent > 0:")
try:
    result = client.table("stock_ratings").select("symbol", count="exact").gt("change_percent", 0).execute()
    print(f"   Found {result.count} stocks with change_percent > 0")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 5: Check if there are stocks with current_price >= 0.2
print("\n5️⃣  Checking stocks with current_price >= 0.2:")
try:
    result = client.table("stock_ratings").select("symbol", count="exact").gte("current_price", 0.2).execute()
    print(f"   Found {result.count} stocks with current_price >= 0.2")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 60)
print("Diagnosis:")
print("=" * 60)
print("If get_summary returns 0s → Database has no data or wrong date filter")
print("If get_top_gainers returns empty → SQL logic issue in function")
print("If raw table has data but get_top_gainers empty → CTE filtering too aggressive")
