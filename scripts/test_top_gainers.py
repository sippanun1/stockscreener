#!/usr/bin/env python3
"""
Test Top Gainers API responses directly
"""

import os
import sys
from supabase import create_client

# Get credentials
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    print("❌ Set SUPABASE_URL and SUPABASE_KEY first!")
    sys.exit(1)

client = create_client(supabase_url, supabase_key)

print("=" * 60)
print("Testing Top Gainers API Responses")
print("=" * 60)

# Test 1: get_top_gainers (for card)
print("\n1️⃣  Testing get_top_gainers (Card data):")
print("-" * 60)
try:
    result = client.rpc("get_top_gainers", {
        "target_market": None,
        "target_date": None,
        "limit_val": 3
    }).execute()
    
    print(f"✅ Success! Found {len(result.data)} stocks")
    for i, stock in enumerate(result.data, 1):
        print(f"   {i}. {stock['symbol']:15} {stock['market']:8} +{stock['change_percent']:6.2f}%")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 2: get_stocks with top_gainers sort (for table)
print("\n2️⃣  Testing get_stocks with top_gainers sort (Table data):")
print("-" * 60)
try:
    result = client.rpc("get_stocks", {
        "target_market": None,
        "target_date": None,
        "search_term": None,
        "target_rating": None,
        "target_technical_rating": None,
        "sort_by": "top_gainers",
        "sort_order": "desc",
        "limit_val": 3,
        "offset_val": 0,
        "lookback_days": None
    }).execute()
    
    print(f"✅ Success! Found {len(result.data)} stocks")
    for i, stock in enumerate(result.data, 1):
        cp = stock.get('change_percent', 0)
        print(f"   {i}. {stock['symbol']:15} {stock['market']:8} +{cp:6.2f}%")
except Exception as e:
    print(f"❌ Error: {e}")

# Compare
print("\n3️⃣  Comparison:")
print("-" * 60)
try:
    card_result = client.rpc("get_top_gainers", {"target_market": None, "target_date": None, "limit_val": 3}).execute()
    table_result = client.rpc("get_stocks", {
        "target_market": None, "target_date": None, "search_term": None,
        "target_rating": None, "target_technical_rating": None,
        "sort_by": "top_gainers", "sort_order": "desc",
        "limit_val": 3, "offset_val": 0, "lookback_days": None
    }).execute()
    
    card_symbols = [s['symbol'] for s in card_result.data]
    table_symbols = [s['symbol'] for s in table_result.data]
    
    print(f"Card:  {card_symbols}")
    print(f"Table: {table_symbols}")
    
    if card_symbols == table_symbols:
        print("\n✅ MATCH! Card and table show same stocks!")
    else:
        print("\n❌ MISMATCH! Different stocks!")
        print("\nMissing from table:")
        for sym in card_symbols:
            if sym not in table_symbols:
                print(f"  - {sym}")
        print("\nExtra in table:")
        for sym in table_symbols:
            if sym not in card_symbols:
                print(f"  - {sym}")
except Exception as e:
    print(f"❌ Error: {e}")
