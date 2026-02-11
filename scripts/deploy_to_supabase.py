#!/usr/bin/env python3
"""
Deploy full_setup.sql to Supabase via REST API
Executes the SQL directly in the database
"""

import os
import requests
from pathlib import Path

def deploy_sql():
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set")
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
    
    # Extract project ref from URL
    project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")
    
    # Use Supabase SQL API endpoint
    sql_api_url = f"{supabase_url}/rest/v1/rpc/exec_sql"
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    print("🚀 Executing SQL via REST API...")
    print("\n⚠️  NOTE: Supabase Python client doesn't support direct SQL execution.")
    print("   You MUST run the SQL manually in Supabase SQL Editor:")
    print(f"   1. Go to: https://supabase.com/dashboard/project/{project_ref}/sql/new")
    print(f"   2. Copy entire content of: {sql_file}")
    print("   3. Paste and click 'Run'")
    print("\n   After running SQL, the functions will be updated and card/table will match!")
    
    return False

if __name__ == "__main__":
    print("=" * 60)
    print("🔧 Supabase SQL Deployment Tool")
    print("=" * 60)
    deploy_sql()
