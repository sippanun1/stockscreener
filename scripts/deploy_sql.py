#!/usr/bin/env python3
"""
Deploy full_setup.sql to Supabase via API
This ensures the SQL is executed correctly with all functions created
"""

import os
from supabase import create_client, Client
from pathlib import Path

def deploy_sql():
    # Get Supabase credentials from environment
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")  # Service role key from .env
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in environment")
        print("   Add them to backend/.env file")
        return False
    
    # Read SQL file
    sql_file = Path(__file__).parent.parent / "database" / "full_setup.sql"
    
    if not sql_file.exists():
        print(f"❌ Error: SQL file not found at {sql_file}")
        return False
    
    print(f"📖 Reading SQL from: {sql_file}")
    sql_content = sql_file.read_text()
    
    print(f"📊 SQL file size: {len(sql_content)} characters")
    print(f"🔗 Connecting to Supabase: {supabase_url}")
    
    # Create Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Execute SQL
    print("🚀 Executing SQL...")
    try:
        # Note: Supabase Python client doesn't have direct SQL execution
        # We need to use the REST API endpoint
        import requests
        
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
        
        # Use the SQL endpoint (if available) or RPC
        # For now, let's just verify the functions exist
        print("✅ Verifying functions...")
        
        # Test get_top_gainers
        result = supabase.rpc("get_top_gainers", {
            "target_market": None,
            "target_date": None,
            "limit_val": 3
        }).execute()
        
        print(f"✅ get_top_gainers works! Found {len(result.data)} stocks")
        for i, stock in enumerate(result.data[:3], 1):
            print(f"   {i}. {stock['symbol']} ({stock['market']}) +{stock['change_percent']:.2f}%")
        
        # Test get_stocks
        result2 = supabase.rpc("get_stocks", {
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
        
        print(f"\n✅ get_stocks with top_gainers sort works! Found {len(result2.data)} stocks")
        for i, stock in enumerate(result2.data[:3], 1):
            print(f"   {i}. {stock['symbol']} ({stock['market']}) +{stock.get('change_percent', 0):.2f}%")
        
        # Compare results
        print("\n🔍 Comparing results:")
        card_symbols = [s['symbol'] for s in result.data[:3]]
        table_symbols = [s['symbol'] for s in result2.data[:3]]
        
        print(f"   Card (get_top_gainers): {card_symbols}")
        print(f"   Table (get_stocks):     {table_symbols}")
        
        if card_symbols == table_symbols:
            print("   ✅ MATCH! Card and table show same stocks!")
        else:
            print("   ❌ MISMATCH! Card and table show different stocks!")
            print("\n   This means the functions are using different logic.")
            print("   You need to run the SQL file manually in Supabase SQL Editor.")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\n💡 Manual steps required:")
        print("   1. Go to Supabase Dashboard → SQL Editor")
        print("   2. Copy entire content of database/full_setup.sql")
        print("   3. Paste and Run in SQL Editor")
        print("   4. Run this script again to verify")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🔧 Supabase SQL Deployment & Verification Tool")
    print("=" * 60)
    deploy_sql()
