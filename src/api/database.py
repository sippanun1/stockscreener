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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(symbol, fetched_date)
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


def save_daily_stocks(stocks_list: list, date: Optional[str] = None):
    """
    Save daily stock data to the database.
    
    Args:
        stocks_list: List of stock dictionaries with keys:
            - symbol, market, name, current_price, Technical_Score, Technical_Rating
            - fetched_at (optional): timestamp like "2026-01-05 16:04:25" - date extracted from this
        date: Default date if fetched_at not present in record. Defaults to today.
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
            if stock.get("fetched_at"):
                # Extract date part from "2026-01-05 16:04:25"
                record_date = stock["fetched_at"].split(" ")[0]
            
            cursor.execute("""
                INSERT INTO stock_ratings 
                (symbol, market, name, current_price, technical_score, technical_rating, fetched_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, fetched_date) DO UPDATE SET
                    current_price = excluded.current_price,
                    technical_score = excluded.technical_score,
                    technical_rating = excluded.technical_rating
            """, (
                stock.get("symbol"),
                stock.get("market"),
                stock.get("name"),
                stock.get("current_price"),
                stock.get("Technical_Score"),
                stock.get("Technical_Rating"),
                record_date
            ))
            
            if cursor.rowcount == 1:
                inserted += 1
            else:
                updated += 1
                
        except Exception as e:
            print(f">> Error inserting {stock.get('symbol')}: {e}")
    
    conn.commit()
    conn.close()
    
    print(f">> Saved {inserted} new, {updated} updated stocks")
    return {"inserted": inserted, "updated": updated}


def get_stocks_with_previous_rating(
    market: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Get stocks with their "last different rating".
    
    This returns the most recent rating that was DIFFERENT from the current rating,
    not just yesterday's rating.
    
    Args:
        market: Filter by market (US, TH, HK, JP) or None for all
        date: Date to query. Defaults to most recent date in DB.
        limit: Maximum number of results
        offset: Pagination offset
    
    Returns:
        List of stock dictionaries with current_rating and previous_rating
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get the latest date if not specified
    if date is None:
        cursor.execute("SELECT MAX(fetched_date) as max_date FROM stock_ratings")
        result = cursor.fetchone()
        date = result["max_date"] if result else datetime.now().strftime("%Y-%m-%d")
    
    # Query with subquery to find "last different rating"
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
                    AND prev.fetched_date < today.fetched_date
                    AND prev.technical_rating != today.technical_rating
                ORDER BY prev.fetched_date DESC 
                LIMIT 1
            ) AS previous_rating,
            (
                SELECT prev.fetched_date 
                FROM stock_ratings prev 
                WHERE prev.symbol = today.symbol 
                    AND prev.fetched_date < today.fetched_date
                    AND prev.technical_rating != today.technical_rating
                ORDER BY prev.fetched_date DESC 
                LIMIT 1
            ) AS previous_rating_date,
            (
                SELECT prev.current_price 
                FROM stock_ratings prev 
                WHERE prev.symbol = today.symbol 
                    AND prev.fetched_date < today.fetched_date
                    AND prev.technical_rating != today.technical_rating
                ORDER BY prev.fetched_date DESC 
                LIMIT 1
            ) AS previous_price
        FROM stock_ratings today
        WHERE today.fetched_date = ?
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
        cursor.execute("SELECT MAX(fetched_date) as max_date FROM stock_ratings")
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
        SELECT DISTINCT fetched_date 
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
            technical_rating
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


# Initialize database on import
init_db()
