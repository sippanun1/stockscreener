"""
SQLite Database Layer for Stock Screener
=========================================
Handles all database operations including:
- Table creation and initialization
- Daily stock data insertion
- Query functions for stocks with "last different rating"
"""

import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional

# Database file path
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "stocks.db"


def get_connection():
    """Get a database connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with required tables and indexes."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create main stock_ratings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            market TEXT NOT NULL,
            name TEXT,
            current_price REAL,
            technical_score REAL,
            technical_rating TEXT,
            fetched_date DATE NOT NULL,
            fetched_time TIME,
            session_type TEXT DEFAULT 'post_market',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(symbol, fetched_date, session_type)
        )
    """)
    
    # Create indexes for fast queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_symbol ON stock_ratings(symbol)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fetched_date ON stock_ratings(fetched_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_symbol_date ON stock_ratings(symbol, fetched_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_market ON stock_ratings(market)")
    
    conn.commit()
    conn.close()
    print(f">> Database initialized at {DB_PATH}")


def save_daily_stocks(stocks_list: list, date: Optional[str] = None, session_type: str = 'post_market'):
    """
    Save daily stock data to the database.
    
    Args:
        stocks_list: List of stock dictionaries with keys:
            - symbol, market, name, current_price, Technical_Score, Technical_Rating
            - fetched_at (optional): timestamp like "2026-01-05 16:04:25" - date extracted from this
        date: Default date if fetched_at not present in record. Defaults to today.
        session_type: 'pre_market' or 'post_market' (default: 'post_market')
    """
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    inserted = 0
    updated = 0
    
    for stock in stocks_list:
        try:
            # Use fetched_at from record if available, otherwise use default date
            record_date = date
            record_time = datetime.now().strftime("%H:%M:%S")
            
            if stock.get("fetched_at"):
                # Extract date and time from "2026-01-05 16:04:25"
                parts = stock["fetched_at"].split(" ")
                record_date = parts[0]
                if len(parts) > 1:
                    record_time = parts[1]
            
            cursor.execute("""
                INSERT INTO stock_ratings 
                (symbol, market, name, current_price, technical_score, technical_rating, fetched_date, fetched_time, session_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, fetched_date, session_type) DO UPDATE SET
                    current_price = excluded.current_price,
                    technical_score = excluded.technical_score,
                    technical_rating = excluded.technical_rating,
                    fetched_time = excluded.fetched_time
            """, (
                stock.get("symbol"),
                stock.get("market"),
                stock.get("name"),
                stock.get("current_price"),
                stock.get("Technical_Score"),
                stock.get("Technical_Rating"),
                record_date,
                record_time,
                session_type
            ))
            
            if cursor.rowcount == 1:
                inserted += 1
            else:
                updated += 1
                
        except Exception as e:
            print(f">> Error inserting {stock.get('symbol')}: {e}")
    
    conn.commit()
    conn.close()
    
    print(f">> Saved {inserted} new, {updated} updated stocks ({session_type} session)")
    return {"inserted": inserted, "updated": updated}


def get_stocks_with_previous_rating(
    market: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Get stocks with their "last different rating".
    
    If date is None, returns the latest entry for each stock (regardless of when it was fetched).
    This allows showing all markets even when they have different latest dates.
    
    Args:
        market: Filter by market (US, TH, HK, JP) or None for all
        date: Date to query. If None, gets latest entry per stock.
        limit: Maximum number of results
        offset: Pagination offset
    
    Returns:
        List of stock dictionaries with current_rating and previous_rating
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    if date is None:
        # Get latest NON-NEUTRAL entry for each stock (across all dates)
        query = """
            WITH latest_non_neutral AS (
                SELECT 
                    symbol,
                    market,
                    name,
                    current_price,
                    technical_score,
                    technical_rating,
                    fetched_date,
                    ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY fetched_date DESC) as rn
                FROM stock_ratings
                WHERE technical_rating != 'Neutral'
            )
            SELECT 
                today.symbol,
                today.market,
                today.name,
                today.current_price,
                today.technical_score,
                today.technical_rating AS current_rating,
                today.fetched_date,
                (
                    SELECT prev.technical_rating 
                    FROM stock_ratings prev 
                    WHERE prev.symbol = today.symbol 
                        AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                        AND prev.technical_rating != today.technical_rating
                        AND prev.technical_rating != 'Neutral'
                    ORDER BY prev.fetched_date DESC 
                    LIMIT 1
                ) AS previous_rating,
                (
                    SELECT prev.fetched_date 
                    FROM stock_ratings prev 
                    WHERE prev.symbol = today.symbol 
                        AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                        AND prev.technical_rating != today.technical_rating
                        AND prev.technical_rating != 'Neutral'
                    ORDER BY prev.fetched_date DESC 
                    LIMIT 1
                ) AS previous_rating_date,
                (
                    SELECT prev.current_price 
                    FROM stock_ratings prev 
                    WHERE prev.symbol = today.symbol 
                        AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                        AND prev.technical_rating != today.technical_rating
                        AND prev.technical_rating != 'Neutral'
                    ORDER BY prev.fetched_date DESC 
                    LIMIT 1
                ) AS previous_price,
                (
                    SELECT MIN(rcd.fetched_date)
                    FROM stock_ratings rcd
                    WHERE rcd.symbol = today.symbol
                    AND DATE(rcd.fetched_date) > IFNULL((
                        SELECT DATE(prev.fetched_date) 
                        FROM stock_ratings prev 
                        WHERE prev.symbol = today.symbol 
                            AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                            AND prev.technical_rating != today.technical_rating
                            AND prev.technical_rating != 'Neutral'
                        ORDER BY prev.fetched_date DESC 
                        LIMIT 1
                    ), '1970-01-01')
                ) AS rating_change_date
            FROM latest_non_neutral today
            WHERE today.rn = 1
        """
        params = []
        
        # Always filter out stocks with price below 0.1
        query += " AND today.current_price >= 0.1"
        
        if market:
            query += " AND today.market = ?"
            params.append(market)
        
        # Order by when current rating started (most recent first)
        query += " ORDER BY today.fetched_date DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
    else:
        # Original behavior: filter by specific date
        query = """
            SELECT 
                today.symbol,
                today.market,
                today.name,
                today.current_price,
                today.technical_score,
                today.technical_rating AS current_rating,
                today.fetched_date,
                (
                    SELECT prev.technical_rating 
                    FROM stock_ratings prev 
                    WHERE prev.symbol = today.symbol 
                        AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                        AND prev.technical_rating != today.technical_rating
                    ORDER BY prev.fetched_date DESC 
                    LIMIT 1
                ) AS previous_rating,
                (
                    SELECT prev.fetched_date 
                    FROM stock_ratings prev 
                    WHERE prev.symbol = today.symbol 
                        AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                        AND prev.technical_rating != today.technical_rating
                    ORDER BY prev.fetched_date DESC 
                    LIMIT 1
                ) AS previous_rating_date,
                (
                    SELECT prev.current_price 
                    FROM stock_ratings prev 
                    WHERE prev.symbol = today.symbol 
                        AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                        AND prev.technical_rating != today.technical_rating
                    ORDER BY prev.fetched_date DESC 
                    LIMIT 1
                ) AS previous_price,
                (
                    SELECT MIN(rcd.fetched_date)
                    FROM stock_ratings rcd
                    WHERE rcd.symbol = today.symbol
                    AND DATE(rcd.fetched_date) > IFNULL((
                        SELECT DATE(prev.fetched_date) 
                        FROM stock_ratings prev 
                        WHERE prev.symbol = today.symbol 
                            AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                            AND prev.technical_rating != today.technical_rating
                        ORDER BY prev.fetched_date DESC 
                        LIMIT 1
                    ), '1970-01-01')
                ) AS rating_change_date
            FROM stock_ratings today
            WHERE DATE(today.fetched_date) = ?
        """
        
        params = [date]
        
        if market:
            query += " AND today.market = ?"
            params.append(market)
        
        query += " ORDER BY today.symbol LIMIT ? OFFSET ?"
        params.extend([limit, offset])
    
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "symbol": row["symbol"],
            "market": row["market"],
            "name": row["name"],
            "current_price": row["current_price"],
            "previous_price": row["previous_price"],
            "Technical_Rating": row["current_rating"],
            "Previous_Rating": row["previous_rating"],
            "previous_rating_date": row["previous_rating_date"],
            "rating_change_date": row["rating_change_date"],
            "fetched_date": row["fetched_date"]
        })
    
    conn.close()
    return results


def get_signal_changes(
    market: Optional[str] = None,
    date: Optional[str] = None,
    signal_type: Optional[str] = None
):
    """
    Get only stocks where the rating has changed from the previous entry.
    
    Args:
        market: Filter by market or None for all
        date: Date to query
        signal_type: "UPGRADE", "DOWNGRADE", or None for all changes
    
    Returns:
        List of stocks with signal changes
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    if date is None:
        cursor.execute("SELECT DATE(MAX(fetched_date)) as max_date FROM stock_ratings")
        result = cursor.fetchone()
        date = result["max_date"] if result else datetime.now().strftime("%Y-%m-%d")
    
    # Rating order for upgrade/downgrade comparison
    rating_order = {
        "Strong Sell": 1,
        "Sell": 2,
        "Neutral": 3,
        "Buy": 4,
        "Strong Buy": 5
    }
    
    # Get all stocks with previous rating
    stocks = get_stocks_with_previous_rating(market=market, date=date, limit=100000)
    
    # Filter to only those with changes
    changes = []
    for stock in stocks:
        prev = stock.get("Previous_Rating")
        curr = stock.get("Technical_Rating")
        
        if prev and prev != curr:
            # Determine if upgrade or downgrade
            prev_order = rating_order.get(prev, 0)
            curr_order = rating_order.get(curr, 0)
            
            change_type = "UPGRADE" if curr_order > prev_order else "DOWNGRADE"
            
            if signal_type is None or signal_type == change_type:
                stock["change_type"] = change_type
                changes.append(stock)
    
    conn.close()
    return changes


def get_available_dates():
    """Get list of all dates that have data in the database."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT DISTINCT DATE(fetched_date) as fetched_date
        FROM stock_ratings 
        ORDER BY fetched_date DESC
    """)
    
    dates = [row["fetched_date"] for row in cursor.fetchall()]
    conn.close()
    return dates


def get_stock_history(symbol: str, days: int = 30):
    """Get historical ratings for a specific stock."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            fetched_date,
            current_price,
            technical_rating,
            name,
            market
        FROM stock_ratings
        WHERE symbol = ?
        ORDER BY fetched_date DESC
        LIMIT ?
    """, (symbol, days))
    
    history = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return history


def get_stats():
    """Get database statistics."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM stock_ratings")
    total_rows = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(DISTINCT symbol) as unique_stocks FROM stock_ratings")
    unique_stocks = cursor.fetchone()["unique_stocks"]
    
    cursor.execute("SELECT COUNT(DISTINCT fetched_date) as total_days FROM stock_ratings")
    total_days = cursor.fetchone()["total_days"]
    
    cursor.execute("SELECT MIN(fetched_date) as oldest, MAX(fetched_date) as newest FROM stock_ratings")
    date_range = cursor.fetchone()
    
    conn.close()
    
    return {
        "total_rows": total_rows,
        "unique_stocks": unique_stocks,
        "total_days": total_days,
        "date_range": {
            "oldest": date_range["oldest"],
            "newest": date_range["newest"]
        }
    }


def get_today_summary():
    """
    Get summary statistics for today's signals.
    
    Returns:
        - total_signals_today: Number of stocks that changed rating today
        - upgrades: Number of stocks with positive rating changes
        - strong_buy_count: Number of upgrades to Strong Buy
    """
    from datetime import datetime
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get the latest date in database
    cursor.execute("SELECT MAX(DATE(fetched_date)) as latest_date FROM stock_ratings")
    latest_result = cursor.fetchone()
    latest_date = latest_result["latest_date"] if latest_result else datetime.now().strftime("%Y-%m-%d")
    
    # Get all stocks that changed rating today (fetched_date = today)
    query = """
        SELECT 
            today.symbol,
            today.technical_rating AS current_rating,
            (
                SELECT prev.technical_rating 
                FROM stock_ratings prev 
                WHERE prev.symbol = today.symbol 
                    AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                    AND prev.technical_rating != today.technical_rating
                ORDER BY prev.fetched_date DESC 
                LIMIT 1
            ) AS previous_rating
        FROM stock_ratings today
        WHERE DATE(today.fetched_date) = ?
    """
    
    cursor.execute(query, [latest_date])
    results = cursor.fetchall()
    
    # Define rating hierarchy
    rating_values = {
        "Strong Sell": 1,
        "Sell": 2,
        "Neutral": 3,
        "Buy": 4,
        "Strong Buy": 5
    }
    
    total_signals = 0
    upgrades = 0
    downgrades = 0
    strong_buy_count = 0
    buy_count = 0
    strong_sell_count = 0
    sell_count = 0
    
    for row in results:
        current = row["current_rating"]
        previous = row["previous_rating"]
        
        # Only count if there was a previous rating AND current is not Neutral
        if previous and current != "Neutral" and previous != "Neutral":
            total_signals += 1
            
            # Count upgrades: Only count if current is Buy or Strong Buy
            if current == "Strong Buy":
                upgrades += 1
                strong_buy_count += 1
            elif current == "Buy":
                upgrades += 1
                buy_count += 1
            # Count downgrades: Only count if current is Sell or Strong Sell
            elif current == "Strong Sell":
                downgrades += 1
                strong_sell_count += 1
            elif current == "Sell":
                downgrades += 1
                sell_count += 1
    
    # Get yesterday's data for comparison
    from datetime import datetime, timedelta
    
    # Calculate yesterday's date
    latest_dt = datetime.strptime(latest_date, "%Y-%m-%d")
    yesterday_dt = latest_dt - timedelta(days=1)
    yesterday_date = yesterday_dt.strftime("%Y-%m-%d")
    
    yesterday_total = 0
    yesterday_upgrades = 0
    
    # Get yesterday's signals
    cursor.execute(query, [latest_date])
    yesterday_results = cursor.fetchall()
    
    for row in yesterday_results:
        current = row["current_rating"]
        previous = row["previous_rating"]
        
        if previous:
            yesterday_total += 1
            
            current_val = rating_values.get(current, 0)
            previous_val = rating_values.get(previous, 0)
            
            if current_val > previous_val:
                yesterday_upgrades += 1
    
    # Calculate percentage changes
    change_from_yesterday = 0.0
    if yesterday_total > 0:
        change_from_yesterday = ((total_signals - yesterday_total) / yesterday_total) * 100
        
    upgrades_change_from_yesterday = 0.0
    if yesterday_upgrades > 0:
        upgrades_change_from_yesterday = ((upgrades - yesterday_upgrades) / yesterday_upgrades) * 100

    # Top 3 Opportunities: Top gainers compared to previous trading day
    top_opportunities = []
    if latest_date:
        # Find the actual previous trading day from database (not calendar yesterday)
        cursor.execute("""
            SELECT DISTINCT DATE(fetched_date) as date 
            FROM stock_ratings 
            WHERE DATE(fetched_date) < ?
            ORDER BY DATE(fetched_date) DESC
            LIMIT 1
        """, (latest_date,))
        prev_row = cursor.fetchone()
        
        if prev_row:
            previous_trading_date = prev_row["date"]
            
            query_top = """
            SELECT 
                today.symbol,
                today.name,
                today.current_price,
                today.technical_rating,
                (
                    SELECT prev.current_price 
                    FROM stock_ratings prev 
                    WHERE prev.symbol = today.symbol 
                    AND DATE(prev.fetched_date) = ?
                    LIMIT 1
                ) as yesterday_price
            FROM stock_ratings today
            WHERE DATE(today.fetched_date) = ?
            AND today.technical_rating IN ('Buy', 'Strong Buy')
            AND today.current_price >= 0.1
            """
            cursor.execute(query_top, (previous_trading_date, latest_date))
        
        candidates = []
        for row in cursor.fetchall():
            curr = row["current_price"]
            yesterday = row["yesterday_price"]
            if curr and yesterday and yesterday > 0:
                change_pct = ((curr - yesterday) / yesterday) * 100
                candidates.append({
                    "symbol": row["symbol"],
                    "market": row["symbol"].split(":")[0] if ":" in row["symbol"] else "",
                    "name": row["name"],
                    "change_percent": change_pct
                })
        
        if candidates:
            # Sort by change percent descending and get top 3
            candidates.sort(key=lambda x: x["change_percent"], reverse=True)
            top_opportunities = candidates[:3]

    conn.close()
    
    return {
        "total_signals_today": total_signals,
        "upgrades": upgrades,
        "downgrades": downgrades,
        "strong_buy_count": strong_buy_count,
        "buy_count": buy_count,
        "strong_sell_count": strong_sell_count,
        "sell_count": sell_count,
        "date": latest_date,
        "change_from_yesterday": round(change_from_yesterday, 1),
        "upgrades_change_from_yesterday": round(upgrades_change_from_yesterday, 1),
        "top_opportunities": top_opportunities
    }


def get_stocks_by_rating(rating: str, date: Optional[str] = None, limit: int = 1000):
    """
    Get all stocks with a specific current rating (that have changed to this rating).
    
    Args:
        rating: Technical rating to filter by (Strong Buy, Buy, Strong Sell, Sell)
        date: Date to query. If None, gets latest date.
        limit: Maximum number of results
    
    Returns:
        List of stock dictionaries with the specified current rating
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest date if not specified
    if date is None:
        cursor.execute("SELECT MAX(DATE(fetched_date)) as latest_date FROM stock_ratings")
        latest_result = cursor.fetchone()
        date = latest_result["latest_date"] if latest_result else datetime.now().strftime("%Y-%m-%d")
    
    # Get all stocks with the specified rating that changed to it (have a previous different rating)
    query = """
        SELECT 
            today.symbol,
            today.market,
            today.name,
            today.current_price,
            today.technical_rating AS current_rating,
            (
                SELECT prev.technical_rating 
                FROM stock_ratings prev 
                WHERE prev.symbol = today.symbol 
                    AND DATE(prev.fetched_date) < DATE(today.fetched_date)
                    AND prev.technical_rating != today.technical_rating
                ORDER BY prev.fetched_date DESC 
                LIMIT 1
            ) AS previous_rating
        FROM stock_ratings today
        WHERE DATE(today.fetched_date) = ?
            AND today.technical_rating = ?
            AND today.current_price >= 0.1
        ORDER BY today.current_price DESC
        LIMIT ?
    """
    
    cursor.execute(query, [date, rating, limit])
    
    results = []
    for row in cursor.fetchall():
        # Only include stocks that have actually changed to this rating
        if row["previous_rating"]:
            results.append({
                "symbol": row["symbol"],
                "market": row["market"],
                "name": row["name"],
                "current_price": row["current_price"],
                "current_rating": row["current_rating"],
                "previous_rating": row["previous_rating"]
            })
    
    conn.close()
    return results


# Initialize database on import
init_db()
