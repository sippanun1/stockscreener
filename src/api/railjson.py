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

def now_ts():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


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

        try:
            r = requests.post(url, data=json.dumps(payload), headers=headers, cookies=cookies, timeout=30)
            r.raise_for_status()
            data = r.json().get("data", [])
        except requests.exceptions.Timeout:
            print(f">> Timeout fetching {market_name} at offset {start}. Stopping.")
            break
        except requests.exceptions.ConnectionError:
            print(f">> Connection error fetching {market_name}. Stopping.")
            break
        except requests.exceptions.RequestException as e:
            print(f">> Request error: {e}. Stopping.")
            break

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
# fetch_single_market_append
# ================================
def fetch_single_market_append(market, url):
    print(f"\n>> Fetching {market} at {datetime.now()}")

    df = fetch_market(market, url)
    if df is None:
        return

    now = datetime.now()
    ts_str = now.strftime("%Y-%m-%d %H:%M:%S")
    ts_epoch = int(now.timestamp())

    df["fetched_at"] = ts_str
    df["fetched_at_epoch"] = ts_epoch

    # =====================
    # 1️⃣ Per-market file
    # =====================
    market_file = DATA_DIR / f"{market}.json"

    if market_file.exists():
        old_df = pd.read_json(market_file, dtype=str)
        df_str = df.astype(str)
        combined_market = pd.concat([old_df, df_str], ignore_index=True)
    else:
        combined_market = df.astype(str)

    combined_market.to_json(market_file, orient="records", indent=2)
    print(f">> Appended {len(df)} rows to {market_file}")

    # =====================
    # 2️⃣ ALL_MARKETS file
    # =====================
    all_file = DATA_DIR / "ALL_MARKETS.json"

    if all_file.exists():
        old_all = pd.read_json(all_file, dtype=str)
        combined_all = pd.concat([old_all, df_str], ignore_index=True)
    else:
        combined_all = df.astype(str)

    combined_all.to_json(all_file, orient="records", indent=2)
    print(f">> Appended {len(df)} rows to {all_file}")


# ================================
# Schedule function
# ================================
def schedule_market_fetches():
    # 🇯🇵 Japan 14:00
    schedule.every().day.at("14:00").do(
        fetch_single_market_append, "JP", screeners["JP"]
    )

    # 🇭🇰 Hong Kong 16:00
    schedule.every().day.at("16:00").do(
        fetch_single_market_append, "HK", screeners["HK"]
    )

    # 🇹🇭 Thailand 17:30
    schedule.every().day.at("17:30").do(
        fetch_single_market_append, "TH", screeners["TH"]
    )

    # 🇺🇸 USA 04:00
    schedule.every().day.at("04:00").do(
        fetch_single_market_append, "US", screeners["US"]
    )

    print(">> Market schedulers started")
    print("JP 14:00 | HK 16:00 | TH 17:30 | US 04:00")

    while True:
        schedule.run_pending()
        time.sleep(60)


# ================================
# Run once on startup + schedule
# ================================
if __name__ == "__main__":
    print(">> Starting Stock Screener API (Multi-Market Scheduler)")

    # Optional: run all once at startup
    #for market, url in screeners.items():
    #    fetch_single_market_append(market, url)

    scheduler_thread = threading.Thread(
        target=schedule_market_fetches,
        daemon=True
    )
    scheduler_thread.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n>> Shutting down...")
