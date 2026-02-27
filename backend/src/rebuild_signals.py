"""
rebuild_signals.py

Purges all signal_returns data and rebuilds from scratch by replaying
stock_ratings history day-by-day, applying the correct "hold until rating changes" model:

- Signal OPENS when rating changes (to a non-Neutral value)
- Signal HOLDS while rating stays the same (no new row created)
- Signal CLOSES using today's Open Price when rating changes again
- Win = return_1d > 0.2%
"""

import sys
import logging
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

sys.path.append('backend/src')
load_dotenv('backend/src/.env')

from database import get_client


def rebuild_all_signals():
    client = get_client()

    # ── 1. TRUNCATE signal_returns via a quick SQL RPC ───────────────────
    print("Step 1: Truncating all signal_returns data...")
    # Use rpc to truncate - faster than batched deletes
    try:
        client.rpc("truncate_signal_returns", {}).execute()
        print("  Done via RPC truncate.")
    except Exception:
        # Fallback: delete in batches until empty
        print("  RPC not available, falling back to batched deletes...")
        while True:
            res = client.table("signal_returns").select("id").limit(1000).execute()
            if not res.data:
                break
            ids = [r["id"] for r in res.data]
            client.table("signal_returns").delete().in_("id", ids).execute()
        print("  Done via batched deletes.")
    print("")

    # ── 2. Reset accuracy counters ────────────────────────────────────────
    print("Step 2: Resetting accuracy counters in latest_stock_ratings...")
    client.table("latest_stock_ratings").update({
        "accuracy_percent": None,
        "total_signals": 0
    }).neq("symbol", "").execute()
    print("  Done.\n")

    # ── 3. Fetch all unique (symbol, market) pairs with pagination ────────
    print("Step 3: Fetching stock list...")
    stocks = []
    page_size = 1000
    offset = 0
    while True:
        res = client.table("latest_stock_ratings").select("symbol, market")\
            .range(offset, offset + page_size - 1).execute()
        if not res.data:
            break
        stocks.extend(res.data)
        if len(res.data) < page_size:
            break
        offset += page_size
    print(f"  Found {len(stocks)} stocks.\n")

    # ── 4. Replay each stock's rating history chronologically ─────────────
    print("Step 4: Replaying history per stock...")
    total_signals_created = 0
    total_signals_closed = 0

    for idx, stock in enumerate(stocks):
        symbol = stock["symbol"]
        market = stock["market"]

        # Fetch distinct daily ratings, ordered oldest→newest
        # Use ONE row per day (max fetched_time = latest intraday reading)
        history_res = client.table("stock_ratings")\
            .select("fetched_date, technical_rating, previous_rating, open, current_price")\
            .eq("symbol", symbol)\
            .order("fetched_date", desc=False)\
            .order("fetched_time", desc=True)\
            .execute()

        if not history_res.data:
            continue

        # De-duplicate: keep one row per fetched_date (the latest reading of that day)
        seen_dates = {}
        for row in history_res.data:
            d = row["fetched_date"]
            if d not in seen_dates:
                seen_dates[d] = row

        days = list(seen_dates.values())  # already sorted by date asc

        active_signal = None  # Track the currently open signal

        for day in days:
            date = day["fetched_date"]
            rating = day["technical_rating"]
            open_price = day["open"] or day["current_price"]

            if not rating or rating == "Neutral":
                # Neutral day - close any active signal (rating gone)
                if active_signal and open_price:
                    entry = active_signal["signal_entry_price"]
                    ret = ((open_price - entry) / entry * 100) if entry > 0 else 0
                    client.table("signal_returns").update({
                        "exit_price": open_price,
                        "return_1d": ret,
                        "return_1d_calculated_at": date,
                        "status": "closed",
                    }).eq("id", active_signal["id"]).execute()
                    total_signals_closed += 1
                    active_signal = None
                continue

            if active_signal is None:
                # No open signal - open one
                ins = client.table("signal_returns").upsert({
                    "symbol": symbol,
                    "market": market,
                    "signal_date": date,
                    "from_rating": day.get("previous_rating") or "Neutral",
                    "to_rating": rating,
                    "signal_entry_price": open_price,
                    "status": "active",
                }, on_conflict="symbol,signal_date").execute()
                active_signal = ins.data[0] if ins.data else None
                if active_signal:
                    total_signals_created += 1

            elif active_signal["to_rating"] != rating:
                # Rating changed - close old signal, open new one
                entry = active_signal["signal_entry_price"]
                if open_price and entry and entry > 0:
                    ret = ((open_price - entry) / entry * 100)
                else:
                    ret = 0

                client.table("signal_returns").update({
                    "exit_price": open_price,
                    "return_1d": ret,
                    "return_1d_calculated_at": date,
                    "status": "closed",
                }).eq("id", active_signal["id"]).execute()
                total_signals_closed += 1

                # Open new signal
                ins = client.table("signal_returns").upsert({
                    "symbol": symbol,
                    "market": market,
                    "signal_date": date,
                    "from_rating": active_signal["to_rating"],
                    "to_rating": rating,
                    "signal_entry_price": open_price,
                    "status": "active",
                }, on_conflict="symbol,signal_date").execute()
                active_signal = ins.data[0] if ins.data else None
                if active_signal:
                    total_signals_created += 1
            # else: same rating, same signal - do nothing

        if (idx + 1) % 100 == 0:
            print(f"  Processed {idx+1}/{len(stocks)} stocks | "
                  f"Signals created: {total_signals_created} | closed: {total_signals_closed}")

    print(f"\nStep 4 done: {total_signals_created} signals created, "
          f"{total_signals_closed} closed.")

    # ── 5. Recalculate accuracies ─────────────────────────────────────────
    print("\nStep 5: Recalculating accuracies via calculate_all_accuracies()...")
    client.rpc("calculate_all_accuracies", {}).execute()
    print("  Done!")
    print("\n✅ Rebuild complete!")


if __name__ == "__main__":
    rebuild_all_signals()
