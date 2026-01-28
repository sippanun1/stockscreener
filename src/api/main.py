import requests
import json
import pandas as pd
import time
import sys
from datetime import datetime
import schedule
import threading
import os
from pathlib import Path

# ================================
# Setup data directory
# ================================
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# ================================
# Columns that work across all markets
# ================================
columns = [
    "name",
    "close",
    "open",
    "premarket_close",
    "premarket_open",
    "postmarket_close",
    "postmarket_open",
    "Recommend.All",
    "description"
]

# ================================
# TradingView Markets
# ================================
screeners = {
    "US": "https://scanner.tradingview.com/america/scan",
    "HK": "https://scanner.tradingview.com/hongkong/scan",
    "TH": "https://scanner.tradingview.com/thailand/scan",
    "JP": "https://scanner.tradingview.com/japan/scan",
    "IN": "https://scanner.tradingview.com/india/scan",
    "VN": "https://scanner.tradingview.com/vietnam/scan",
    "UK": "https://scanner.tradingview.com/uk/scan"
}
}

headers = {
    "accept": "application/json",
    "content-type": "text/plain;charset=UTF-8",
    "origin": "https://www.tradingview.com",
    "referer": "https://www.tradingview.com/",
    "user-agent": "Mozilla/5.0",
}

cookies = {"cookiesSettings": '{"analytics":true,"advertising":true}'}

# ================================
# Convert numeric → label
# ================================
def convert_rating(score):
    if score is None:
        return "NA"
    if score >= 0.5:
        return "Strong Buy"
    elif score > 0.1:
        return "Buy"
    elif -0.1 <= score <= 0.1:
        return "Neutral"
    elif score < -0.1 and score >= -0.5:
        return "Sell"
    else:
        return "Strong Sell"

# ================================
# Robust Save Helper
# ================================
def save_to_db_with_retry(df, market, today, retries=3, delay=2):
    """
    Attempts to save dataframe to DB.
    Returns True if success, False if all retries failed.
    """
    for attempt in range(1, retries + 1):
        try:
            import database
            stocks_list = df.to_dict('records')
            database.save_daily_stocks(stocks_list, today, session_type='post_market')
            print(f">> ✅ Success: Saved {market} to Database")
            return True # Success!
        except Exception as e:
            print(f">> ⚠️ Attempt {attempt}/{retries} failed: {e}")
            if attempt < retries:
                time.sleep(delay)
    
    return False # All retries failed

# ================================
# Fetch unlimited rows + ONLY STOCK
# ================================
def fetch_market(market_name, url, batch_size=300):
    print(f"\n>> Fetching market: {market_name}")

    all_rows = []
    start = 0

    while True:
        payload = {
            "columns": columns,
            "range": [start, start + batch_size],
            "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"},

            # ⭐⭐ FILTER ONLY REAL STOCKS ⭐⭐
            "markets": ["stock"],
            "symbols": {
                "query": {"types": ["stock"]},
                "tickers": []
            },

            "filter": [
                {"left": "market_cap_basic", "operation": "nempty"}
            ]
        }

        r = requests.post(url, data=json.dumps(payload), headers=headers, cookies=cookies)
        data = r.json().get("data", [])

        if not data:
            print(f">> No more data for {market_name} (total {len(all_rows)})")
            break

        all_rows.extend(data)
        start += batch_size
        time.sleep(0.2)

    if not all_rows:
        print(f">> No rows returned for {market_name}")
        return None

    out = []
    fetched_time = datetime.now()
    fetched_at_str = fetched_time.strftime("%Y-%m-%d %H:%M:%S")
    fetched_at_epoch = int(fetched_time.timestamp())

    for row in all_rows:
        d = row["d"]
        score = d[7]

        out.append({
            "market": market_name,
            "symbol": row["s"],
            "name": d[0],
            "current_price": d[1],
            "open": d[2],
            "premarket_close": d[3],
            "premarket_open": d[4],
            "postmarket_close": d[5],
            "postmarket_open": d[6],
            "Technical_Score": score,
            "Technical_Rating": convert_rating(score),
            "fetched_at": fetched_at_str,
            "fetched_at_epoch": fetched_at_epoch
        })

    return pd.DataFrame(out)

# ================================
# Main fetch function (runs daily)
# ================================
def fetch_all_markets():
    print(f"\n{'='*50}")
    print(f">> Starting daily market fetch at {datetime.now()}")
    print(f"{'='*50}\n")

    today = datetime.now().strftime("%Y-%m-%d")
    all_df = []

    for market, url in screeners.items():
        try:
            df = fetch_market(market, url)
            if df is not None:
                # 1. BUFFER: Save JSON immediately
                filename = DATA_DIR / f"{market}_{today}.json"
                df.to_json(filename, orient='records', indent=2)
                print(f">> 📦 Buffered {filename} ({len(df)} rows)")
                
                # 2. PUSH with RETRY
                success = save_to_db_with_retry(df, market, today)

                # 3. CLEANUP or ALERT
                if success:
                    if filename.exists():
                        filename.unlink() 
                        print(f">> 🧹 Cleaned up buffer file: {filename.name}")
                else:
                    # ❌ FAILURE after retries - KEEP FILE & ALERT USER
                    print(f"\n{'!'*50}")
                    print(f"❌ CRITICAL ERROR: Could not save {market} to Database after 3 attempts.")
                    print(f"📦 DATA SAVED IN: {filename.name}")
                    print(f"🛠️  TO FIX: Run 'python main.py --import-local' later.")
                    print(f"{'!'*50}\n")

                all_df.append(df)
        except Exception as e:
            print(f">> Error fetching {market}: {e}")

    if all_df:
        combined = pd.concat(all_df, ignore_index=True)
        combined_filename = DATA_DIR / f"ALL_MARKETS_{today}.json"
        combined.to_json(combined_filename, orient='records', indent=2)
        print(f"\n>> Saved combined file: {combined_filename}")
        
        # ⭐ Save to SQLite database
        # (Already saved incrementally above to prevent data loss)
        # try:
        #     import database
        #     stocks_list = combined.to_dict('records')
        #     database.save_daily_stocks(stocks_list, today, session_type='post_market')
        #     print(">> Saved to SQLite database")
        # except Exception as e:
        #     print(f">> Error saving to SQLite: {e}")
        
        print("\n>> DONE - All Markets Fetched Successfully!")
    else:
        print("\n>> No data was fetched")

    print(f"\n{'='*50}")


# ================================
# Schedule function
# ================================
def schedule_daily_fetch():
    # Schedule the fetch to run every day at 16:30
    schedule.every().day.at("16:30").do(fetch_all_markets)
    
    print(">> Scheduler started. Next fetch scheduled at 16:30 daily.")
    
    # Keep the scheduler running in a separate thread
    while True:
        schedule.run_pending()
        time.sleep(60)

# ================================
# Run once on startup + schedule
# ================================
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Fetch stock market data')
    parser.add_argument('--market', type=str, help='Specific market to fetch (US, HK, TH, JP)', default=None)
    parser.add_argument('--once', action='store_true', help='Run once and exit (for GitHub Actions)')
    parser.add_argument('--preopen', action='store_true', help='Mark this as pre-market data (before market opens)')
    parser.add_argument('--import-local', action='store_true', help='Import data from local JSON files instead of fetching (Recovery Mode)')
    args = parser.parse_args()
    
    if args.import_local:
        # ================================
        # Recovery Mode: Import Local JSONs
        # ================================
        print(f"\n{'='*50}")
        print(f">> 📦 Starting Local Import (Recovery Mode)")
        print(f"{'='*50}\n")
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Look for files matching pattern: {MARKET}_{TODAY}.json
        files_found = list(DATA_DIR.glob(f"*_{today}.json"))
        
        if not files_found:
            print(f">> No buffer files found for today ({today}).")
            sys.exit(0)
            
        print(f">> Found {len(files_found)} buffer files.")
        
        for json_file in files_found:
            market_name = json_file.name.split('_')[0]
            print(f"\n>> Processing {json_file.name}...")
            
            try:
                # Load JSON
                with open(json_file, 'r') as f:
                    data = json.load(f)
                    df = pd.DataFrame(data)
                
                print(f">> Loaded {len(df)} rows.")
                
                # Push to DB with retry
                success = save_to_db_with_retry(df, market_name, today)
                
                if success:
                    json_file.unlink()
                    print(f">> 🧹 Cleaned up buffer file: {json_file.name}")
                else:
                    print(f">> ❌ Failed to import {json_file.name}. File kept.")
                    
            except Exception as e:
                print(f">> ⚠️ Error processing {json_file.name}: {e}")
                
        print("\n>> Recovery process completed.")
        sys.exit(0)
        
    if args.once or args.market:
        # Run once mode (for GitHub Actions or specific market)
        print(f">> Running in once mode{f' for market: {args.market}' if args.market else ''}")
        
        if args.market:
            # Fetch specific market only
            market = args.market.upper()
            if market in screeners:
                today = datetime.now().strftime("%Y-%m-%d")
                try:
                    df = fetch_market(market, screeners[market])
                    if df is not None:
                        filename = DATA_DIR / f"{market}_{today}.json"
                        df.to_json(filename, orient='records', indent=2)
                        print(f">> Saved {filename} ({len(df)} rows)")
                        
                        # Save to SQLite
                        try:
                            import database
                            stocks_list = df.to_dict('records')
                            # Add fetched_at timestamp
                            for stock in stocks_list:
                                stock['fetched_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            session_type = 'pre_market' if args.preopen else 'post_market'
                            database.save_daily_stocks(stocks_list, today, session_type=session_type)
                            print(f">> Saved to SQLite database ({session_type} session)")
                        except Exception as e:
                            print(f">> Error saving to SQLite: {e}")
                        
                        print("\n>> DONE - Market Fetched Successfully!")
                        sys.exit(0)
                    else:
                        print(f">> Error: No data fetched for {market}")
                        sys.exit(1)
                except Exception as e:
                    print(f">> Error fetching {market}: {e}")
                    sys.exit(1)
            else:
                print(f">> Error: Invalid market '{market}'. Choose from: {list(screeners.keys())}")
                sys.exit(1)
        else:
            # Fetch all markets
            fetch_all_markets()
            sys.exit(0)
    else:
        # Original scheduler mode (for local development)
        print(">> Starting Stock Screener API...")
        
        # Run once immediately when the script starts
        fetch_all_markets()
        
        # Start the scheduler in a background thread
        scheduler_thread = threading.Thread(target=schedule_daily_fetch, daemon=True)
        scheduler_thread.start()
        
        # Keep the main thread alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n>> Shutting down...")

