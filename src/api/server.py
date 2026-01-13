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


@app.get("/api/summary")
def get_summary():
    """Get today's summary statistics for the dashboard cards."""
    return database.get_today_summary()


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
    
    # Process history Chronologically (Oldest -> Newest) to find signals
    # history is currently DESC (Newest -> Oldest), so reverse it
    chronological_history = history[::-1]
    
    signals = []
    
    if chronological_history:
        current_signal = {
            "rating": chronological_history[0].get("technical_rating", "Neutral"),
            "start_date": chronological_history[0].get("fetched_date"),
            "entry_price": chronological_history[0].get("current_price", 0),
            "status": "OPEN"
        }
        
        from datetime import datetime
        
        for entry in chronological_history[1:]:
            entry_rating = entry.get("technical_rating", "Neutral")
            entry_date = entry.get("fetched_date")
            entry_price = entry.get("current_price", 0)
            
            if entry_rating != current_signal["rating"]:
                # Signal Changed! Complete the previous signal
                # The exit price is the price on the day the rating changed (today in this loop)
                
                # Calculate days held
                try:
                    start = datetime.strptime(current_signal["start_date"].split(" ")[0], "%Y-%m-%d")
                    end = datetime.strptime(entry_date.split(" ")[0], "%Y-%m-%d")
                    days_held = (end - start).days
                except:
                    days_held = 0
                
                # Calculate profit
                profit_percent = 0.0
                if current_signal["entry_price"] > 0:
                    profit_percent = ((entry_price - current_signal["entry_price"]) / current_signal["entry_price"]) * 100
                    
                signals.append({
                    "date": entry_date, # When it changed to the new rating
                    "from_rating": current_signal["rating"],
                    "to_rating": entry_rating, # What it changed TO at the end
                    "entry_price": current_signal["entry_price"],
                    "exit_price": entry_price,
                    "days_held": days_held,
                    "result": profit_percent,
                    "status": "COMPLETED"
                })
                
                # Start new signal
                current_signal = {
                    "rating": entry_rating,
                    "start_date": entry_date,
                    "entry_price": entry_price,
                    "status": "OPEN"
                }
        
        # Add the final (current) signal
        # For current signal, result is unrealized profit (Current Price - Entry Price)
        current_price = chronological_history[-1].get("current_price", 0)
        
        # Calculate days held so far
        try:
            start = datetime.strptime(current_signal["start_date"].split(" ")[0], "%Y-%m-%d")
            now = datetime.now()
            days_held = (now - start).days
        except:
            days_held = 0
            
        profit_percent = 0.0
        if current_signal["entry_price"] > 0:
            profit_percent = ((current_price - current_signal["entry_price"]) / current_signal["entry_price"]) * 100

        signals.append({
            "date": current_signal["start_date"],
            "from_rating": current_signal["rating"],
            "to_rating": "Current",
            "entry_price": current_signal["entry_price"],
            "exit_price": current_price,
            "days_held": days_held,
            "result": profit_percent,
            "status": "OPEN" # Current active signal
        })
    
    # Reverse signals back to Newest -> Oldest for display
    rating_changes = signals[::-1]
    
    # Calculate Real Stats from these signals
    completed_signals = [s for s in rating_changes if s["status"] == "COMPLETED"]
    total_signals = len(completed_signals)
    
    win_rate = 0
    if total_signals > 0:
        wins = len([s for s in completed_signals if s["result"] > 0])
        win_rate = (wins / total_signals) * 100
        
    avg_return = 0
    if total_signals > 0:
        avg_return = sum(s["result"] for s in completed_signals) / total_signals

    stats = {
        "total_signals": total_signals,
        "win_rate": win_rate,
        "avg_return": avg_return,
        "best_return": max([s["result"] for s in completed_signals]) if completed_signals else 0
    }
    
    # Calculate REAL price change from history (already done above but ensuring variables exist)
    change = 0.0
    change_percent = 0.0
    
    if len(history) > 1:
        prev_entry = history[1]
        prev_price = prev_entry.get("current_price", 0)
        
        if prev_price and prev_price > 0:
            change = current.get("current_price", 0) - prev_price
            change_percent = (change / prev_price) * 100

    return {
        "symbol": symbol,
        "name": current.get("name") or (symbol.split(":")[1] if ":" in symbol else symbol),
        "market": symbol.split(":")[0] if ":" in symbol else "",
        "current_price": current.get("current_price", 0),
        "current_rating": current.get("technical_rating", "N/A"),
        "change": change,
        "change_percent": change_percent,
        "stats": stats,
        "history": rating_changes  # Return all signals
    }


if __name__ == "__main__":
    import uvicorn
    print(">> Starting Stock Screener API Server...")
    print(">> API docs available at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
