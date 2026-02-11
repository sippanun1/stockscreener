import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(dotenv_path="backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("❌ Missing SUPABASE_URL or SUPABASE_KEY. Please check backend/.env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def backfill_signals():
    """
    1. Detect Rating Changes from history using SQL logic.
    2. Insert into signal_returns.
    """
    logger.info("🚀 Starting Signal Backfill (Transition Detection)...")
    
    # We use a SQL query to find transitions because it's much faster than Python loops for 870k rows.
    # Logic: Look for rows where the rating is different from the previous row for the same symbol.
    sql_detection = """
    WITH RatingTransitions AS (
        SELECT 
            symbol, 
            market,
            technical_rating as to_rating,
            LAG(technical_rating) OVER (PARTITION BY symbol ORDER BY fetched_date ASC, fetched_time ASC) as from_rating,
            current_price as signal_entry_price,
            fetched_date as signal_date
        FROM public.stock_ratings
        WHERE technical_rating != 'Neutral'
    )
    INSERT INTO public.signal_returns (symbol, market, signal_date, from_rating, to_rating, signal_entry_price)
    SELECT symbol, market, signal_date, from_rating, to_rating, signal_entry_price
    FROM RatingTransitions
    WHERE from_rating IS NOT NULL 
      AND from_rating != to_rating
      AND from_rating != 'Neutral'
    ON CONFLICT DO NOTHING;
    """
    
    # Since we can't run raw SQL easily via the client without an RPC, 
    # and the user might not want to create another RPC, 
    # I'll use a slightly more manual but safe batching approach if needed, 
    # OR better yet, I'll leverage the existing 'get_stocks' logic but for all history.
    
    # Actually, the most robust way to backfill 870k rows is to use an RPC.
    # I'll create a temporary RPC to do the heavy lifting in Postgres.
    
    rpc_setup = """
    CREATE OR REPLACE FUNCTION public.run_signal_backfill()
    RETURNS INTEGER AS $$
    DECLARE rows_inserted INTEGER;
    BEGIN
        WITH RatingTransitions AS (
            SELECT 
                symbol, 
                market,
                technical_rating as to_rating,
                LAG(technical_rating) OVER (PARTITION BY symbol ORDER BY fetched_date ASC, fetched_time ASC) as from_rating,
                current_price as signal_entry_price,
                fetched_date as signal_date
            FROM public.stock_ratings
            WHERE technical_rating != 'Neutral'
        )
        INSERT INTO public.signal_returns (symbol, market, signal_date, from_rating, to_rating, signal_entry_price)
        SELECT symbol, market, signal_date, from_rating, to_rating, signal_entry_price
        FROM RatingTransitions
        WHERE from_rating IS NOT NULL 
          AND from_rating != to_rating
          AND from_rating != 'Neutral'
        ON CONFLICT DO NOTHING;
        
        GET DIAGNOSTICS rows_inserted = ROW_COUNT;
        RETURN rows_inserted;
    END; $$ LANGUAGE plpgsql;
    """
    
    logger.info("📡 Creating temporary backfill RPC...")
    # This assumes the user has permissions to create functions (which they usually do in this env)
    # If not, we'd have to do it in Python batches.
    
    try:
        # We can't run raw SQL CREATE from Python client easily, 
        # so I'll assume the user runs the SQL or I'll provide a separate SQL file.
        # For this script, I'll use Python batching as the primary method to be safe.
        
        logger.info("🔄 Running batch detection in Python (Optimized)...")
        # To avoid memory issues, we process symbols in batches.
        
        symbols_res = supabase.table("stock_ratings").select("symbol").execute()
        symbols = sorted(list(set([r['symbol'] for r in symbols_res.data])))
        logger.info(f"📊 Found {len(symbols)} unique symbols to check.")
        
        total_signals = 0
        for i in range(0, len(symbols), 50): # Process 50 symbols at a time
            batch_symbols = symbols[i:i+50]
            
            # Get historical ratings for these symbols
            history = supabase.table("stock_ratings")\
                .select("symbol, market, technical_rating, current_price, fetched_date")\
                .in_("symbol", batch_symbols)\
                .order("symbol")\
                .order("fetched_date", desc=False)\
                .execute()
            
            current_symbol = None
            prev_rating = None
            
            signals_to_insert = []
            
            for row in history.data:
                sym = row['symbol']
                rating = row['technical_rating']
                
                if rating == 'Neutral':
                    continue
                    
                if sym != current_symbol:
                    current_symbol = sym
                    prev_rating = rating
                    continue
                
                if rating != prev_rating:
                    # Signal Detected!
                    signals_to_insert.append({
                        "symbol": sym,
                        "market": row['market'],
                        "signal_date": row['fetched_date'],
                        "from_rating": prev_rating,
                        "to_rating": rating,
                        "signal_entry_price": row['current_price']
                    })
                    prev_rating = rating
            
            if signals_to_insert:
                supabase.table("signal_returns").upsert(signals_to_insert).execute()
                total_signals += len(signals_to_insert)
                logger.info(f"   ... Processed {i+len(batch_symbols)}/{len(symbols)} symbols. Signals found: {total_signals}")
                
        logger.info(f"✅ Success! Detected and recorded {total_signals} signals.")
        return total_signals

    except Exception as e:
        logger.error(f"❌ Error during backfill: {e}")
        return 0

if __name__ == "__main__":
    backfill_signals()
