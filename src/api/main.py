import requests
import json
import pandas as pd
import time
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
    "Recommend.All"
]

# ================================
# TradingView Markets
# ================================
screeners = {
    "US": "https://scanner.tradingview.com/america/scan",
    "HK": "https://scanner.tradingview.com/hongkong/scan",
    "TH": "https://scanner.tradingview.com/thailand/scan",
    "JP": "https://scanner.tradingview.com/japan/scan"
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

    for row in all_rows:
        d = row["d"]
        score = d[2]

        out.append({
            "market": market_name,
            "symbol": row["s"],
            "name": d[0],
            "current_price": d[1],
            "Technical_Score": score,
            "Technical_Rating": convert_rating(score)
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
                filename = DATA_DIR / f"{market}_{today}.json"
                df.to_json(filename, orient='records', indent=2)
                print(f">> Saved {filename} ({len(df)} rows)")
                all_df.append(df)
        except Exception as e:
            print(f">> Error fetching {market}: {e}")

    if all_df:
        combined = pd.concat(all_df, ignore_index=True)
        combined_filename = DATA_DIR / f"ALL_MARKETS_{today}.json"
        combined.to_json(combined_filename, orient='records', indent=2)
        print(f"\n>> Saved combined file: {combined_filename}")
        
        # ⭐ Save to SQLite database
        try:
            import database
            stocks_list = combined.to_dict('records')
            database.save_daily_stocks(stocks_list, today)
            print(">> Saved to SQLite database")
        except Exception as e:
            print(f">> Error saving to SQLite: {e}")
        
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
