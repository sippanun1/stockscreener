
import os
import logging
from datetime import datetime
from typing import Optional, Dict, List, Any
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in .env file")

# Setup Logger
logger = logging.getLogger(__name__)

# Global Client Instance
_supabase: Optional[Client] = None

def get_client() -> Client:
    """Get or initialize the Supabase client."""
    global _supabase
    if _supabase is None:
        try:
            # Increase timeout to 60 seconds (default is often shorter)
            options = ClientOptions(postgrest_client_timeout=60)
            _supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            raise
    return _supabase

def init_db():
    """
    Check connection to Supabase.
    Schema is managed via SQL Editor / Migrations, so we just verify access.
    """
    try:
        client = get_client()
        # Simple health check
        client.table("stock_ratings").select("count", count="exact").limit(1).execute()
        print(f">> Connected to Supabase at {SUPABASE_URL}")
    except Exception as e:
        print(f">> Failed to connect to Supabase: {e}")
        # Build robustness: Don't crash app, just log error. Main loop handles retries.

def save_daily_stocks(stocks_list: list, date: Optional[str] = None, session_type: str = 'post_market'):
    """
    Save daily stock data to Supabase using UPSERT.
    """
    if not stocks_list:
        return {"inserted": 0, "updated": 0}

    client = get_client()
    
    # Prepare data for bulk upsert
    records = []
    
    # Default data
    default_date = date or datetime.now().strftime("%Y-%m-%d")
    default_time = datetime.now().strftime("%H:%M:%S")

    for stock in stocks_list:
        try:
            # Handle fetched_at parsing
            record_date = default_date
            record_time = default_time
            
            if stock.get("fetched_at"):
                parts = stock["fetched_at"].split(" ")
                record_date = parts[0]
                if len(parts) > 1:
                    record_time = parts[1]

            # Construct record matching Supabase Schema
            record = {
                "symbol": stock.get("symbol"),
                "market": stock.get("market"),
                "name": stock.get("name"),
                "current_price": stock.get("current_price"),
                "open": stock.get("open"),
                # "premarket_close": stock.get("premarket_close"),  <-- REMOVED: unused/empty
                # "premarket_open": stock.get("premarket_open"),    <-- REMOVED: unused/empty
                # "postmarket_close": stock.get("postmarket_close"),<-- REMOVED: unused/empty
                # "postmarket_open": stock.get("postmarket_open"),  <-- REMOVED: unused/empty
                "technical_score": stock.get("Technical_Score"),
                "technical_rating": stock.get("Technical_Rating"),
                "fetched_date": record_date,
                "fetched_time": record_time,
                "session_type": session_type
            }
            records.append(record)
        except Exception as e:
            logger.error(f"Error preparing stock {stock.get('symbol')}: {e}")

    if not records:
        return {"inserted": 0, "updated": 0}

    if not records:
        return {"inserted": 0, "updated": 0}

    # BATCHING LOGIC to prevent "Payload Too Large"
    BATCH_SIZE = 1000
    total_saved = 0
    
    # --- OPTIMIZATION: Fetch Previous Ratings Baseline ---
    # To correctly set `rating_change_date`, we need to compare with the PREVIOUS record.
    # Since checking 1-by-1 is slow, we fetch the latest snapshot for this market.
    
    prev_ratings_map = {}
    try:
        # 1. Identify Market (assume list is consistent)
        target_market = stocks_list[0].get("market") if stocks_list else None
        
        if target_market:
            # 2. Find latest fetched_date BEFORE today
            # We want records strictly before the current batch's date (to avoid comparing with self if re-running)
            target_date_obj = datetime.strptime(default_date, "%Y-%m-%d")
            
            # Simple query to find max date < current
            date_res = client.table("stock_ratings") \
                .select("fetched_date") \
                .eq("market", target_market) \
                .lt("fetched_date", default_date) \
                .order("fetched_date", desc=True) \
                .limit(1) \
                .execute()
                
            if date_res.data:
                baseline_date = date_res.data[0]['fetched_date']
                logger.info(f"Comparing with baseline date: {baseline_date}")
                
                # 3. Fetch all ratings for this baseline date (Handle pagination for >1000 inputs)
                # We need all stocks to ensure map is complete.
                all_baseline = []
                offset = 0
                while True:
                    r = client.table("stock_ratings") \
                        .select("symbol, technical_rating, rating_change_date, current_price") \
                        .eq("market", target_market) \
                        .eq("fetched_date", baseline_date) \
                        .range(offset, offset + 999) \
                        .execute()
                    
                    if not r.data:
                        break
                        
                    all_baseline.extend(r.data)
                    if len(r.data) < 1000:
                        break
                    offset += 1000
                
                # 4. Build Map
                for row in all_baseline:
                    prev_ratings_map[row['symbol']] = {
                        "rating": row.get("technical_rating"),
                        "change_date": row.get("rating_change_date"),
                        "price": row.get("current_price") or 0.0
                    }
                    
    except Exception as e:
        logger.warning(f"Could not fetch baseline ratings (First run?): {e}")

    try:
        # Loop through records in chunks
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i : i + BATCH_SIZE]
            
            # --- LOGIC: Compute rating_change_date & price_change ---
            for rec in batch:
                sym = rec["symbol"]
                curr_rating = rec["technical_rating"]
                curr_price = float(rec["current_price"] or 0)
                
                prev_data = prev_ratings_map.get(sym)
                
                # Default values
                previous_price = 0.0
                price_change = 0.0
                change_percent = 0.0

                if prev_data:
                    prev_rating = prev_data["rating"]
                    prev_date = prev_data["change_date"]
                    previous_price = float(prev_data["price"])
                    
                    # 1. Rating Logic
                    if curr_rating == prev_rating:
                        rec["rating_change_date"] = prev_date if prev_date else rec["fetched_date"]
                    else:
                        rec["rating_change_date"] = rec["fetched_date"]
                        
                    # 2. Price Change Logic (Current - Previous Close)
                    if previous_price > 0:
                        price_change = curr_price - previous_price
                        change_percent = (price_change / previous_price) * 100
                    else:
                        # Fallback to Open if no previous close (or user preference)
                        # For now, 0 if no history
                        pass
                else:
                    # NEW STOCK: Date is today, Change is 0
                    rec["rating_change_date"] = rec["fetched_date"]
                
                # Store calculated values
                rec["price_change"] = round(price_change, 2)
                rec["change_percent"] = round(change_percent, 2)
                # We can also store previous_price if we added a column for it, but not strictly needed if we have change
                rec["previous_price"] = previous_price # Optional mapping if DB has column
            
            response = client.table("stock_ratings").upsert(
                batch, 
                on_conflict="symbol, fetched_date, fetched_time, session_type"
            ).execute()
            
            # Count inserted/updated
            if response.data:
                total_saved += len(response.data)
                
            print(f">> 📦 Batch {i//BATCH_SIZE + 1} saved: {len(batch)} records")

        print(f">> ✅ Total Saved: {total_saved} stocks to Supabase ({session_type})")
        return {"inserted": total_saved, "updated": 0}

    except Exception as e:
        logger.error(f"Supabase Upsert Error: {e}")
        # If one batch fails, we re-raise. Or we could continue?
        # Re-raise to alert main.py to retry the WHOLE logic or log partially.
        # Ideally, main.py should know.
        raise e

def get_stocks_with_previous_rating(
    market: Optional[str] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    rating: Optional[str] = None,
    technical_rating: Optional[str] = None,
    sort_by: str = 'fetched_date',
    sort_order: str = 'desc',
    limit: int = 100,
    offset: int = 0
):
    """
    Get stocks using the Supabase RPC function `get_stocks_with_last_rating`.
    Handles pagination automatically if limit > 1000.
    """
    client = get_client()
    
    all_results = []
    current_offset = offset
    remaining_limit = limit
    
    while remaining_limit > 0:
        # Request in batches of up to 1000 (Supabase default cap)
        batch_size = min(remaining_limit, 1000)
        
        params = {
            "target_market": market,
            "target_date": date,
            "search_term": search,
            "target_rating": rating,
            "target_technical_rating": technical_rating,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "limit_val": batch_size,
            "offset_val": current_offset
        }
        
        try:
            # UPDATED: Use standard function name (removed _v3)
            response = client.rpc("get_stocks", params).execute()
            
            if not response.data:
                break
                
            for row in response.data:
                all_results.append({
                    "symbol": row["symbol"],
                    "market": row["market"],
                    "name": row["name"],
                    "current_price": row["current_price"],
                    "Technical_Rating": row["Technical_Rating"],
                    "Previous_Rating": row["Previous_Rating"],
                    "previous_price": row["previous_price"],
                    "change": row.get("change", 0),
                    "changePercent": row.get("change_percent", 0),
                    "rating_change_date": row["rating_change_date"],
                    "fetched_date": row["fetched_date"],
                    "fetched_time": row["fetched_time"]
                })
            
            if len(response.data) < batch_size:
                break
                
            current_offset += len(response.data)
            remaining_limit -= len(response.data)
            
        except Exception as e:
            logger.error(f"RPC Error on get_stocks_with_last_rating: {e}")
            break
            
    return all_results

def get_stocks_count(
    market: Optional[str] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    rating: Optional[str] = None,
    technical_rating: Optional[str] = None
) -> int:
    """
    Get total count of stocks matching filters.
    Excludes: price < 0.2, OTC stocks (handled by RPC function).
    Returns the actual database count, not just loaded records.
    """
    client = get_client()
    
    try:
        params = {
            "target_market": market,
            "target_date": date,
            "search_term": search,
            "target_rating": rating,
            "target_technical_rating": technical_rating
        }
        
        # Use a dedicated count RPC function for better performance
        response = client.rpc("get_stocks_count_filtered", params).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0].get("total", 0)
        
        return 0
        
    except Exception as e:
        logger.error(f"Error getting stocks count: {e}")
        # Fallback: If count RPC doesn't exist, return 0 to avoid crashes
        return 0

def get_available_dates():
    """Get list of distinct dates from database."""
    client = get_client()
    try:
        # Use a simplified query or RPC? Standard query DISTINCT is tricky in PostgREST unless setup
        # Workaround: Use a simple RPC or just fetch dates order by desc limit 100?
        # Better: create a small RPC for this, OR query logical workaround.
        # Let's assume we can fetch distinct via .select('fetched_date').order... unique?
        # PostgREST doesn't support SELECT DISTINCT easy.
        # Check if user made an RPC? No.
        # Fallback: Query fetches recent dates and we dedupe in Python (inefficient but works for now)
        # OR better: Add `get_unique_dates` RPC later.
        # For now, let's try to just fetch distinct fetched_dates?
        # Actually, let's fallback to standard query logic or assume we just query recent 365 days.
        
        # Quick Fix: Use RPC if exists, otherwise fallback.
        # Let's try to query 'fetched_date' from DB?
        # If we have many rows, this is bad.
        # Let's stick to a robust method: Since we don't have get_dates RPC, implement basic logic.
        
        # Query: select fetched_date from stock_ratings group by fetched_date order by fetched_date desc
        # PostgREST syntax for distinct? .select('fetched_date').csv()?
        # We will use python deduping on a limited fetch for now or error safe.
        # Actually, let's try to make a raw SQL call? No, can't via client easily without RLS holes.
        
        # Let's assume we fetch all unique dates?
        # response = client.table("stock_ratings").select("fetched_date").order("fetched_date", desc=True).execute()
        # That's millions of rows. Bad.
        
        # PROPOSAL: We should probably add `get_avail_dates` RPC.
        # For now, Return empty or dummy if not critical, OR try to fetch a helper view.
        # Let's assume the user has not created `get_available_dates`. 
        # I will fetch metadata from `stock_ratings` just for today/yesterday? 
        
        # For this version, let's return [] and Log a warning that RPC is needed?
        # Or better -> Just return today's date + last 30 days generated? No.
        
        return [] # Placeholder until we add RPC
        
    except Exception as e:
        logger.error(f"Error fetching dates: {e}")
        return []

def get_stats():
    """Get basic stats using count."""
    client = get_client()
    try:
        # Get total rows
        count_res = client.table("stock_ratings").select("id", count="exact").limit(1).execute()
        total_rows = count_res.count or 0
        
        # Unique stocks? Harder without RPC.
        unique_stocks = 0 # Placeholder
        
        return {
            "total_rows": total_rows,
            "unique_stocks": unique_stocks,
            "total_days": 0,
            "date_range": {"oldest": None, "newest": None}
        }
    except Exception as e:
        logger.error(f"Error stats: {e}")
        return {}

def get_stock_history(symbol: str, days: int = 30):
    client = get_client()
    try:
        response = client.table("stock_ratings")\
            .select("*")\
            .eq("symbol", symbol)\
            .neq("technical_rating", "Neutral")\
            .eq("session_type", "post_market")\
            .order("fetched_date", desc=True)\
            .limit(days)\
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"History error: {e}")
        return []

def get_stock_pre_market_history(symbol: str, limit: int = 2):
    client = get_client()
    try:
        response = client.table("stock_ratings")\
            .select("*")\
            .eq("symbol", symbol)\
            .neq("technical_rating", "Neutral")\
            .eq("session_type", "pre_market")\
            .order("fetched_date", desc=True)\
            .limit(limit)\
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Pre-market history error: {e}")
        return []

def get_latest_intraday_records(symbol: str):
    """Fetch intraday records for symbol (Latest Date)."""
    client = get_client()
    try:
        # 1. Get detailed latest date for this symbol?
        # Just fetch latest 50 records ordered by time desc
        response = client.table("stock_ratings")\
            .select("*")\
            .eq("symbol", symbol)\
            .order("fetched_date", desc=True)\
            .order("fetched_time", desc=True)\
            .limit(100)\
            .execute()
            
        if not response.data:
            return []
            
        # Process in Python: Group by Latest Date
        latest_date = response.data[0]["fetched_date"]
        today_records = [r for r in response.data if r["fetched_date"] == latest_date]
        
        # Sort ascending time
        today_records.sort(key=lambda x: x["fetched_time"])
        
        # Find prev record (fetched_date < latest_date)
        prev_record = None
        for r in response.data:
            if r["fetched_date"] < latest_date:
                prev_record = r
                break
                
        return {
            "date": latest_date,
            "today_records": today_records,
            "prev_record": prev_record
        }

    except Exception as e:
        logger.error(f"Intraday error: {e}")
        return []
        
# --- Placeholder functions for complex analytics waiting for RPC ---
# We can't easily implement 'get_signal_changes' or 'get_today_summary' cleanly without RPC
# on restricted Anon/Service keys if we want performance.
# For now, I'll return empty or basic structures to prevent crashes on frontend calls.

def get_signal_changes(market: Optional[str] = None, date: Optional[str] = None, signal_type: Optional[str] = None):
    """
    Get stocks where the rating has changed compared to the previous different rating.
    This works by fetching stocks with their previous rating and filtering in Python
    (since complex cross-row logic is hard in Supabase simple queries without specific RPC).
    """
    client = get_client()
    try:
        # Use existing RPC that already calculates previous rating!
        # RPC: get_stocks_with_last_rating
        params = {
            "target_market": market,
            "target_date": date,
            "search_term": None,
            "limit_val": 1000, # Cap at 1000 for performance
            "offset_val": 0
        }
        
        response = client.rpc("get_stocks_with_last_rating", params).execute()
        
        if not response.data:
            return []
            
        results = []
        for row in response.data:
            current = row.get("current_rating")
            previous = row.get("previous_rating")
            
            # Filter for actual changes
            if current and previous and current != previous and current != "Neutral" and previous != "Neutral":
                
                # Determine Upgrade/Downgrade
                score_map = {"Strong Buy": 2, "Buy": 1, "Neutral": 0, "Sell": -1, "Strong Sell": -2, "NA": 0}
                curr_score = score_map.get(current, 0)
                prev_score = score_map.get(previous, 0)
                
                change_type = "UPGRADE" if curr_score > prev_score else "DOWNGRADE"
                
                # Filter by signal_type if requested
                if signal_type and signal_type.upper() != change_type:
                    continue
                    
                results.append({
                    "symbol": row["symbol"],
                    "market": row["market"],
                    "name": row["name"],
                    "current_rating": current,
                    "previous_rating": previous,
                    "previous_rating_date": row["previous_rating_date"],
                    "change_type": change_type,
                    "fetched_date": row["fetched_date"]
                })
                
        return results
        
    except Exception as e:
        logger.error(f"Error getting signal changes: {e}")
        return []

def get_today_summary(market=None, date=None):
    client = get_client()
    try:
        # 1. Get Stats (Counts) [Updated: removed _v3]
        stats_res = client.rpc("get_dashboard_stats", {
            "target_market": market,
            "target_date": date
        }).execute()
        
        if not stats_res.data:
             return _empty_summary()
            
        # Handle response format (List vs Dict)
        data = stats_res.data
        if isinstance(data, list):
            data = data[0] if data else {}
            
        # 2. Get Top Gainers [Updated: removed _v3]
        gainers_res = client.rpc("get_top_gainers", {
            "target_market": market,
            "target_date": date,
            "limit_val": 3
        }).execute()
        top_gainers = gainers_res.data if gainers_res.data else []

        # Map SQL keys (e.g. 'strong_buy') to Frontend keys (if needed)
        # SQL returns: strong_buy, buy, strong_sell, sell, total_positive, total_negative, date
        
        strong_buy = data.get("strong_buy", 0)
        buy = data.get("buy", 0)
        strong_sell = data.get("strong_sell", 0)
        sell = data.get("sell", 0)
        
        # Calculate total signals if not provided (or use specific totals)
        total_signals = data.get("total_positive", 0) + data.get("total_negative", 0) + data.get("neutral", 0)
        
        return {
            "total_signals_today": total_signals,
            "strong_buy_count": strong_buy,
            "buy_count": buy, 
            "strong_sell_count": strong_sell,
            "sell_count": sell,
            "date": data.get("date"),
            
            # Map aggregated counts for "Positive/Negative Signals" cards
            "upgrades": data.get("total_positive", 0),       # Positive Card Big Number
            "downgrades": data.get("total_negative", 0),    # Negative Card Big Number
            
            "change_from_yesterday": 0, 
            "upgrades_change_from_yesterday": 0, 
            "top_opportunities": top_gainers
        }
    except Exception as e:
        logger.error(f"Error summary: {e}")
        return _empty_summary()
        return _empty_summary()

def _empty_summary():
    return {
        "total_signals_today": 0,
        "upgrades": 0, "downgrades": 0,
        "strong_buy_count": 0, "buy_count": 0, 
        "strong_sell_count": 0, "sell_count": 0,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "top_opportunities": []
    }

def get_stocks_by_rating(rating: str, date: Optional[str] = None, limit: int = 1000):
   """
   Get stocks filtered by rating.
   Uses the RPC function `get_stocks_with_last_rating` to ensure consistent filtering.
   Handles pagination if limit > 1000.
   """
   client = get_client()
   all_results = []
   current_offset = 0
   remaining_limit = limit

   while remaining_limit > 0:
       batch_size = min(remaining_limit, 1000)
       try:
           res = client.rpc("get_stocks_with_last_rating", {
               "target_rating": rating,
               "target_date": date,
               "limit_val": batch_size,
               "offset_val": current_offset
           }).execute()
           
           if not res.data:
               break
               
           all_results.extend(res.data)
           
           if len(res.data) < batch_size:
               break
               
           current_offset += len(res.data)
           remaining_limit -= len(res.data)

       except Exception as e:
           logger.error(f"Error fetching stocks by rating: {e}")
           break
           
   return all_results
        
# Deprecated: SQLite connection removed. Use Supabase client.
def get_connection():
    raise NotImplementedError("SQLite connection is deprecated. Use Supabase client.")

def get_intraday_comparison(date: str, market: Optional[str] = None):
    """
    Compare Pre-market vs Post-market (Regular) data for a given date.
    Replaces the raw SQL JOIN query.
    """
    client = get_client()
    
    try:
        # 1. Fetch Pre-Market
        pre_query = client.table("stock_ratings").select("*").eq("fetched_date", date).eq("session_type", "pre_market")
        if market:
            pre_query = pre_query.eq("market", market)
        pre_data = pre_query.execute().data
        
        # 2. Fetch Post-Market
        post_query = client.table("stock_ratings").select("*").eq("fetched_date", date).eq("session_type", "post_market")
        if market:
            post_query = post_query.eq("market", market)
        post_data = post_query.execute().data
        
        # 3. Join in Memory
        # Map Pre-market by symbol
        pre_map = {item["symbol"]: item for item in pre_data}
        
        results = []
        for post in post_data:
            symbol = post["symbol"]
            if symbol in pre_map:
                pre = pre_map[symbol]
                
                # Logic from SQL: rating_changed, price_change
                rating_changed = 1 if pre["technical_rating"] != post["technical_rating"] else 0
                price_change = (float(post["current_price"] or 0)) - (float(pre["current_price"] or 0))
                
                results.append({
                    "symbol": symbol,
                    "market": post["market"],
                    "name": post["name"],
                    "preopen_rating": pre["technical_rating"],
                    "preopen_price": pre["current_price"],
                    "preopen_time": pre["fetched_time"],
                    "regular_rating": post["technical_rating"],
                    "regular_price": post["current_price"],
                    "regular_time": post["fetched_time"],
                    "price_change": price_change,
                    "rating_changed": rating_changed
                })
        
        # Sort by rating_changed DESC, price_change DESC
        results.sort(key=lambda x: (x["rating_changed"], abs(x["price_change"])), reverse=True)
        
        return results

    except Exception as e:
        logger.error(f"Intraday Comparison Error: {e}")
        return []
