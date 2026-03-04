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
    "name",           # Index 0
    "close",          # Index 1 - current price
    "open",           # Index 2
    "premarket_close", # Index 3
    "premarket_open",  # Index 4
    "postmarket_close",# Index 5
    "postmarket_open", # Index 6
    "sector",          # Index 7
    "industry",        # Index 8
    "Recommend.All",   # Index 9 - technical score
    "description",     # Index 10 - company name
    "change",          # Index 11: Percent Change
    "change_abs",      # Index 12: Absolute Change
    # --- Breakout Score Columns ---
    "EMA14",                   # Index 13
    "EMA20",                   # Index 14
    "RSI14",                   # Index 15
    "High.All",                # Index 16 - 52-week high
    "volume",                  # Index 17
    "average_volume_10d_calc", # Index 18
]


# ================================
# Breakout Score Calculator
# ================================
def compute_breakout_score(price, ema14, ema20, rsi14, high_52w, volume, avg_volume_10d):
    """
    Compute Breakout Entry score (0-4) based on 4 conditions:
    1. Price > EMA14 AND EMA20
    2. RSI14 > 50
    3. Price closed above 52-week high (breakout)
    4. Volume > 10-day average volume
    """
    score = 0
    details = {}

    # Condition 1: Price above both EMA14 and EMA20
    cond1 = (
        price is not None and ema14 is not None and ema20 is not None
        and price > ema14 and price > ema20
    )
    details["price_above_ema"] = bool(cond1)
    if cond1:
        score += 1

    # Condition 2: RSI14 > 50
    cond2 = (rsi14 is not None and rsi14 > 50)
    details["rsi_above_50"] = bool(cond2)
    if cond2:
        score += 1

    # Condition 3: Price broke and closed above 52-week high
    cond3 = (price is not None and high_52w is not None and high_52w > 0 and price >= high_52w)
    details["broke_52w_high"] = bool(cond3)
    if cond3:
        score += 1

    # Condition 4: Today volume > 10-day average volume
    cond4 = (
        volume is not None and avg_volume_10d is not None
        and avg_volume_10d > 0 and volume > avg_volume_10d
    )
    details["volume_above_avg"] = bool(cond4)
    if cond4:
        score += 1

    return score, details

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
            # Fix JSON NaN error: Replace NaN with None (Robust)
            df_clean = df.astype(object).where(pd.notnull(df), None)
            # Fix Duplicate Rows error: Drop duplicates by symbol
            df_clean = df_clean.drop_duplicates(subset=['symbol'])
            
            stocks_list = df_clean.to_dict('records')
            database.save_daily_stocks(stocks_list, today, session_type='post_market')
            print(f">> ✅ Success: Saved {market} to Database")
            return True # Success!
        except Exception as e:
            error_msg = str(e).lower()
            print(f">> ⚠️ Attempt {attempt}/{retries} failed: {e}")
            
            # Add helpful troubleshooting hints for common errors
            if "name or service not known" in error_msg or "failed to fetch" in error_msg:
                print(">> 💡 HINT: DNS connection failed. Is your Supabase project PAUSED?")
                print(">> 💡 HINT: Or is the SUPABASE_URL missing/incorrect in GitHub Action Secrets?")
            elif "timeout" in error_msg:
                print(">> 💡 HINT: Database might be waking up or overloaded. Retrying...")
            elif "authentication" in error_msg or "jwt" in error_msg:
                print(">> 💡 HINT: Auth failed. Check if SUPABASE_KEY in GitHub Secrets is valid.")
                
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
                {"left": "market_cap_basic", "operation": "nempty"},
                {"left": "exchange", "operation": "not_in_range", "right": ["OTC"]} # filter out OTC
            ]
        }

        try:
            r = requests.post(url, data=json.dumps(payload), headers=headers, cookies=cookies)
            if r.status_code != 200:
                print(f">> Error fetching {market_name}: Status {r.status_code}")
                break
                
            data = r.json().get("data", [])

            if not data:
                print(f">> No more data for {market_name} (total {len(all_rows)})")
                break

            all_rows.extend(data)
            start += batch_size
            time.sleep(0.2)
            
        except Exception as e:
            print(f">> Error in request: {e}")
            break

    if not all_rows:
        print(f">> No rows returned for {market_name}")
        return None

    out = []
    fetched_time = datetime.now()
    fetched_at_str = fetched_time.strftime("%Y-%m-%d %H:%M:%S")
    fetched_at_epoch = int(fetched_time.timestamp())

    for row in all_rows:
        d = row["d"]
        score = d[9]  # Fixed: d[9] is Recommend.All (Technical Score)

        # --- FILTERS ---
        # 1. Filter out Penny Stocks (Price < 0.20)
        if d[1] is None or d[1] < 0.2:
            continue
            
        # 2. Filter out OTC Stocks (Symbol or Exchange)
        raw_symbol = row.get("s", "")
        # Check exchange in d[0] (name) or if symbol has :OTC
        if "OTC" in raw_symbol or "PINK" in raw_symbol:
            continue

        # --- Extract Breakout Columns (safe with fallback None) ---
        current_price = d[1]
        ema14         = d[13] if len(d) > 13 else None
        ema20         = d[14] if len(d) > 14 else None
        rsi14         = d[15] if len(d) > 15 else None
        high_52w      = d[16] if len(d) > 16 else None
        volume        = d[17] if len(d) > 17 else None
        avg_vol_10d   = d[18] if len(d) > 18 else None

        # --- Compute Breakout Score ---
        b_score, b_details = compute_breakout_score(
            current_price, ema14, ema20, rsi14, high_52w, volume, avg_vol_10d
        )

        out.append({
            "market": market_name,
            "symbol": row["s"],
            "name": d[10],  # d[10] is description (full company name)
            "current_price": current_price,
            "open": d[2],
            "premarket_close": d[3],
            "premarket_open": d[4],
            "postmarket_close": d[5],
            "postmarket_open": d[6],
            "sector": d[7],  # d[7] is sector
            "industry": d[8],  # d[8] is industry
            "Technical_Score": score,
            "Technical_Rating": convert_rating(score),
            "daily_change_percent": d[11] if len(d) > 11 else 0, # From source
            "daily_change_amount": d[12] if len(d) > 12 else 0,  # From source
            # --- Breakout Fields ---
            "ema14": ema14,
            "ema20": ema20,
            "rsi14": rsi14,
            "high_52w": high_52w,
            "volume": volume,
            "avg_volume_10d": avg_vol_10d,
            "breakout_score": b_score,
            # Store details as compact JSON string for optional inspection
            "breakout_details": b_details,
            "fetched_at": fetched_at_str,
            "fetched_at_epoch": fetched_at_epoch
        })

    return pd.DataFrame(out)

# ================================
# Main fetch function (runs daily)
# ================================
def fetch_all_markets(args=None):
    print(f"\n{'='*50}")
    print(f">> Starting daily market fetch at {datetime.now()}")
    print(f"{'='*50}\n")

    today = datetime.now().strftime("%Y-%m-%d")
    all_df = []
    
    # Determine markets to run
    markets_to_run = screeners.items()
    if args and args.market:
        if args.market in screeners:
            markets_to_run = [(args.market, screeners[args.market])]
        else:
            print(f"Market {args.market} not found. Available: {list(screeners.keys())}")
            return

    for market, url in markets_to_run:
        try:
            df = fetch_market(market, url)
            if df is not None:
                # 1. BUFFER: Save JSON immediately
                filename = DATA_DIR / f"{market}_{today}.json"
                df.to_json(filename, orient='records', indent=2)
                print(f">> 📦 Buffered {filename} ({len(df)} rows)")
                
                # 2. PUSH with RETRY
                # Only save to DB if NO args or if args.once is True (Manual run)
                # But actually we always want to save.
                success = save_to_db_with_retry(df, market, today)

                # 3. CLEANUP or ALERT
                if success:
                    # CLEANUP: Only if NOT in 'once' mode (GitHub Actions needs the file for validation)
                    # Note: We need access to args here. If args is None, assume we clean?
                    # Or safer: Check if running via scheduler (args=None)?
                    # Logic: If args.once is TRUE, DO NOT CLEAN.
                    should_clean = True
                    if args and args.once:
                        should_clean = False
                    
                    if should_clean:
                        if filename.exists():
                            filename.unlink() 
                            print(f">> 🧹 Cleaned up buffer file: {filename.name}")
                    else:
                        print(f">> ℹ️  File kept for validation: {filename.name}")

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
        
        print("\n>> DONE - All Markets Fetched Successfully!")
    else:
        print("\n>> No data was fetched")

    print(f"\n{'='*50}")


# ================================
# Schedule function
# ================================
def run_scheduler():
    print(">> 🕒 Scheduler Started. Waiting for 18:00 (Thailand Time)...")
    # Thailand is UTC+7. Server might be UTC.
    # 18:00 TH = 11:00 UTC.
    # Safe bet: Run every hour? No, once a day.
    # Let's set 11:00 UTC (18:00 BKK)
    schedule.every().day.at("11:00").do(fetch_all_markets)

    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Run once now and exit")
    parser.add_argument("--market", type=str, help="Run specific market (e.g. TH)")
    parser.add_argument("--preopen", action="store_true", help="Fetch pre-market data (Not implemented yet)")
    args = parser.parse_args()

    if args.once:
        print(f">> Running in once mode{' for market: ' + args.market if args.market else ''}")
        fetch_all_markets(args)
    else:
        run_scheduler()
