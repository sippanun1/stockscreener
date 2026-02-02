"""
PostgreSQL Database Adapter
============================
Drop-in replacement for database.py that uses native PostgreSQL instead of Supabase.

Usage:
    1. Install psycopg2: pip install psycopg2-binary
    2. Update .env with PostgreSQL credentials (see .env.example)
    3. In server.py, replace: import database  →  import database_postgres as database
"""

import os
import logging
from datetime import datetime
from typing import Optional, Dict, List, Any
from pathlib import Path
from contextlib import contextmanager

from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch
import psycopg2.pool

# Load environment variables
load_dotenv()

# Configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "stockscreener")
DB_USER = os.getenv("DB_USER", "stockuser")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not DB_PASSWORD:
    raise ValueError("DB_PASSWORD must be set in .env file")

# Setup Logger
logger = logging.getLogger(__name__)

# Connection Pool (for better performance)
_connection_pool = None


def init_db():
    """Initialize database connection pool."""
    global _connection_pool
    
    try:
        _connection_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        
        print(f">> Connected to PostgreSQL at {DB_HOST}:{DB_PORT}/{DB_NAME}")
        logger.info(f"Database connection pool initialized")
        
        # Test connection
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
                logger.info(f"PostgreSQL version: {version}")
                
    except Exception as e:
        print(f">> Failed to connect to PostgreSQL: {e}")
        logger.error(f"Database initialization failed: {e}")
        raise


@contextmanager
def get_connection():
    """Get database connection from pool."""
    global _connection_pool
    
    if _connection_pool is None:
        init_db()
    
    conn = _connection_pool.getconn()
    try:
        yield conn
    finally:
        _connection_pool.putconn(conn)


def save_daily_stocks(stocks_list: list, date: Optional[str] = None, session_type: str = 'post_market'):
    """
    Save daily stock data to PostgreSQL using UPSERT.
    Compatible with original database.py function signature.
    """
    if not stocks_list:
        return {"inserted": 0, "updated": 0}
    
    default_date = date or datetime.now().strftime("%Y-%m-%d")
    default_time = datetime.now().strftime("%H:%M:%S")
    
    # Prepare records
    records = []
    for stock in stocks_list:
        try:
            record_date = default_date
            record_time = default_time
            
            if stock.get("fetched_at"):
                parts = stock["fetched_at"].split(" ")
                record_date = parts[0]
                if len(parts) > 1:
                    record_time = parts[1]
            
            record = {
                "symbol": stock.get("symbol"),
                "market": stock.get("market"),
                "name": stock.get("name"),
                "current_price": stock.get("current_price"),
                "open": stock.get("open"),
                "premarket_close": stock.get("premarket_close"),
                "premarket_open": stock.get("premarket_open"),
                "postmarket_close": stock.get("postmarket_close"),
                "postmarket_open": stock.get("postmarket_open"),
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
    
    # Fetch previous ratings baseline
    prev_ratings_map = {}
    target_market = stocks_list[0].get("market") if stocks_list else None
    
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if target_market:
                try:
                    # Get baseline date
                    cur.execute("""
                        SELECT fetched_date 
                        FROM stock_ratings 
                        WHERE market = %s AND fetched_date < %s
                        ORDER BY fetched_date DESC 
                        LIMIT 1
                    """, (target_market, default_date))
                    
                    baseline_row = cur.fetchone()
                    if baseline_row:
                        baseline_date = baseline_row['fetched_date']
                        logger.info(f"Comparing with baseline date: {baseline_date}")
                        
                        # Fetch all ratings for baseline date
                        cur.execute("""
                            SELECT symbol, technical_rating, rating_change_date
                            FROM stock_ratings
                            WHERE market = %s AND fetched_date = %s
                        """, (target_market, baseline_date))
                        
                        for row in cur.fetchall():
                            prev_ratings_map[row['symbol']] = {
                                "rating": row['technical_rating'],
                                "change_date": row['rating_change_date']
                            }
                except Exception as e:
                    logger.warning(f"Could not fetch baseline ratings: {e}")
            
            # Compute rating_change_date for each record
            for rec in records:
                sym = rec["symbol"]
                curr_rating = rec["technical_rating"]
                prev_data = prev_ratings_map.get(sym)
                
                if prev_data:
                    if curr_rating == prev_data["rating"]:
                        rec["rating_change_date"] = prev_data["change_date"] or rec["fetched_date"]
                    else:
                        rec["rating_change_date"] = rec["fetched_date"]
                else:
                    rec["rating_change_date"] = rec["fetched_date"]
            
            # Batch UPSERT
            BATCH_SIZE = 1000
            total_saved = 0
            
            for i in range(0, len(records), BATCH_SIZE):
                batch = records[i : i + BATCH_SIZE]
                
                insert_query = """
                    INSERT INTO stock_ratings (
                        symbol, market, name, current_price, open,
                        premarket_close, premarket_open, postmarket_close, postmarket_open,
                        technical_score, technical_rating, rating_change_date,
                        fetched_date, fetched_time, session_type
                    ) VALUES (
                        %(symbol)s, %(market)s, %(name)s, %(current_price)s, %(open)s,
                        %(premarket_close)s, %(premarket_open)s, %(postmarket_close)s, %(postmarket_open)s,
                        %(technical_score)s, %(technical_rating)s, %(rating_change_date)s,
                        %(fetched_date)s, %(fetched_time)s, %(session_type)s
                    )
                    ON CONFLICT (symbol, fetched_date, fetched_time, session_type)
                    DO UPDATE SET
                        current_price = EXCLUDED.current_price,
                        technical_rating = EXCLUDED.technical_rating,
                        technical_score = EXCLUDED.technical_score,
                        rating_change_date = EXCLUDED.rating_change_date
                """
                
                execute_batch(cur, insert_query, batch, page_size=100)
                conn.commit()
                
                total_saved += len(batch)
                print(f">> 📦 Batch {i//BATCH_SIZE + 1} saved: {len(batch)} records")
            
            print(f">> ✅ Total Saved: {total_saved} stocks to PostgreSQL ({session_type})")
            return {"inserted": total_saved, "updated": 0}


def get_stocks_with_previous_rating(
    market: Optional[str] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get stocks using the PostgreSQL RPC function."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM get_stocks_with_last_rating(%s, %s, %s, %s, %s)
            """, (market, date, search, limit, offset))
            
            rows = cur.fetchall()
            
            results = []
            for row in rows:
                results.append({
                    "symbol": row["symbol"],
                    "market": row["market"],
                    "name": row["name"],
                    "current_price": row["current_price"],
                    "Technical_Rating": row["Technical_Rating"],
                    "Previous_Rating": row["Previous_Rating"],
                    "previous_price": row["previous_price"],
                    "rating_change_date": row["rating_change_date"],
                    "fetched_date": row["fetched_date"],
                    "fetched_time": row["fetched_time"]
                })
            
            return results


def get_stocks_count(
    market: Optional[str] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    rating: Optional[str] = None
) -> int:
    """Get total count of stocks matching filters."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM get_stocks_count_filtered(%s, %s, %s, %s)
            """, (market, date, search, rating))
            
            result = cur.fetchone()
            return result.get("total", 0) if result else 0


def get_today_summary():
    """Get dashboard summary statistics."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get stats
            cur.execute("""
                SELECT * FROM get_dashboard_stats(%s, %s)
            """, (None, None))
            
            stats = cur.fetchone()
            
            # Get top gainers
            cur.execute("""
                SELECT * FROM get_top_gainers(%s, %s, %s)
            """, (None, None, 3))
            
            top_gainers = cur.fetchall()
            
            if not stats:
                return _empty_summary()
            
            return {
                "total_signals_today": stats.get("total_positive", 0) + stats.get("total_negative", 0) + stats.get("neutral", 0),
                "strong_buy_count": stats.get("strong_buy", 0),
                "buy_count": stats.get("buy", 0),
                "strong_sell_count": stats.get("strong_sell", 0),
                "sell_count": stats.get("sell", 0),
                "date": stats.get("date"),
                "upgrades": stats.get("total_positive", 0),
                "downgrades": stats.get("total_negative", 0),
                "change_from_yesterday": 0,
                "upgrades_change_from_yesterday": 0,
                "top_opportunities": list(top_gainers) if top_gainers else []
            }


def get_stock_history(symbol: str, days: int = 30):
    """Get historical ratings for a stock."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM stock_ratings
                WHERE symbol = %s
                  AND technical_rating != 'Neutral'
                  AND session_type = 'post_market'
                ORDER BY fetched_date DESC, fetched_time DESC
                LIMIT %s
            """, (symbol, days))
            
            return [dict(row) for row in cur.fetchall()]


def get_stock_pre_market_history(symbol: str, limit: int = 2):
    """Get pre-market history for a stock."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM stock_ratings
                WHERE symbol = %s
                  AND technical_rating != 'Neutral'
                  AND session_type = 'pre_market'
                ORDER BY fetched_date DESC, fetched_time DESC
                LIMIT %s
            """, (symbol, limit))
            
            return [dict(row) for row in cur.fetchall()]


def get_latest_intraday_records(symbol: str):
    """Fetch intraday records for symbol (Latest Date)."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM stock_ratings
                WHERE symbol = %s
                ORDER BY fetched_date DESC, fetched_time DESC
                LIMIT 100
            """, (symbol,))
            
            rows = cur.fetchall()
            
            if not rows:
                return []
            
            latest_date = rows[0]["fetched_date"]
            today_records = [dict(row) for row in rows if row["fetched_date"] == latest_date]
            today_records.sort(key=lambda x: x["fetched_time"])
            
            prev_record = None
            for row in rows:
                if row["fetched_date"] < latest_date:
                    prev_record = dict(row)
                    break
            
            return {
                "date": latest_date,
                "today_records": today_records,
                "prev_record": prev_record
            }


def get_signal_changes(market: Optional[str] = None, date: Optional[str] = None, signal_type: Optional[str] = None):
    """Get stocks where rating has changed."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM get_stocks_with_last_rating(%s, %s, %s, %s, %s)
            """, (market, date, None, 1000, 0))
            
            rows = cur.fetchall()
            results = []
            
            score_map = {"Strong Buy": 2, "Buy": 1, "Neutral": 0, "Sell": -1, "Strong Sell": -2}
            
            for row in rows:
                current = row.get("technical_rating")
                previous = row.get("previous_rating")
                
                if current and previous and current != previous and current != "Neutral" and previous != "Neutral":
                    curr_score = score_map.get(current, 0)
                    prev_score = score_map.get(previous, 0)
                    change_type = "UPGRADE" if curr_score > prev_score else "DOWNGRADE"
                    
                    if signal_type and signal_type.upper() != change_type:
                        continue
                    
                    results.append({
                        "symbol": row["symbol"],
                        "market": row["market"],
                        "name": row["name"],
                        "current_rating": current,
                        "previous_rating": previous,
                        "previous_rating_date": row.get("rating_change_date"),
                        "change_type": change_type,
                        "fetched_date": row["fetched_date"]
                    })
            
            return results


def get_available_dates():
    """Get list of distinct dates from database."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT DISTINCT fetched_date
                FROM stock_ratings
                ORDER BY fetched_date DESC
                LIMIT 100
            """)
            
            return [row["fetched_date"] for row in cur.fetchall()]


def get_stats():
    """Get database statistics."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Total rows
            cur.execute("SELECT COUNT(*) as count FROM stock_ratings")
            total_rows = cur.fetchone()["count"]
            
            # Unique stocks
            cur.execute("SELECT COUNT(DISTINCT symbol) as count FROM stock_ratings")
            unique_stocks = cur.fetchone()["count"]
            
            # Date range
            cur.execute("""
                SELECT MIN(fetched_date) as oldest, MAX(fetched_date) as newest
                FROM stock_ratings
            """)
            date_range = cur.fetchone()
            
            return {
                "total_rows": total_rows,
                "unique_stocks": unique_stocks,
                "total_days": 0,
                "date_range": {
                    "oldest": date_range["oldest"],
                    "newest": date_range["newest"]
                }
            }


def get_stocks_by_rating(rating: str, date: Optional[str] = None, limit: int = 1000):
    """Get stocks filtered by rating."""
    results = []
    offset = 0
    
    while len(results) < limit:
        batch_size = min(limit - len(results), 1000)
        
        with get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM get_stocks_with_last_rating(%s, %s, %s, %s, %s)
                """, (None, date, None, batch_size, offset))
                
                rows = cur.fetchall()
                
                if not rows:
                    break
                
                # Filter by rating
                for row in rows:
                    if row.get("technical_rating") == rating:
                        results.append(dict(row))
                
                if len(rows) < batch_size:
                    break
                
                offset += batch_size
    
    return results[:limit]


def get_intraday_comparison(date: str, market: Optional[str] = None):
    """Compare pre-market vs post-market data for a given date."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get pre-market
            pre_query = """
                SELECT * FROM stock_ratings
                WHERE fetched_date = %s AND session_type = 'pre_market'
            """
            params = [date]
            if market:
                pre_query += " AND market = %s"
                params.append(market)
            
            cur.execute(pre_query, params)
            pre_data = {row["symbol"]: dict(row) for row in cur.fetchall()}
            
            # Get post-market
            post_query = """
                SELECT * FROM stock_ratings
                WHERE fetched_date = %s AND session_type = 'post_market'
            """
            params = [date]
            if market:
                post_query += " AND market = %s"
                params.append(market)
            
            cur.execute(post_query, params)
            post_data = cur.fetchall()
            
            results = []
            for post in post_data:
                symbol = post["symbol"]
                if symbol in pre_data:
                    pre = pre_data[symbol]
                    
                    rating_changed = 1 if pre["technical_rating"] != post["technical_rating"] else 0
                    price_change = float(post["current_price"] or 0) - float(pre["current_price"] or 0)
                    
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
            
            results.sort(key=lambda x: (x["rating_changed"], abs(x["price_change"])), reverse=True)
            return results


def _empty_summary():
    """Return empty summary structure."""
    return {
        "total_signals_today": 0,
        "upgrades": 0,
        "downgrades": 0,
        "strong_buy_count": 0,
        "buy_count": 0,
        "strong_sell_count": 0,
        "sell_count": 0,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "top_opportunities": []
    }


# Initialize connection pool on import
try:
    init_db()
except Exception as e:
    logger.warning(f"Database not initialized on import: {e}")
