"""
FastAPI Server for Stock Screener
==================================
Provides REST API endpoints for:
- Fetching stocks with previous ratings
- Filtering by market and date
- Getting signal changes

Production ready with:
- CORS configuration via environment variables
- Rate limiting
- API key authentication (optional)
- Proper logging
"""

import os
import logging
from datetime import datetime
from functools import lru_cache
from typing import Optional

from fastapi import FastAPI, Query, HTTPException, Request, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from dotenv import load_dotenv

import database

# Load environment variables
load_dotenv()

# =================================
# Configuration
# =================================
@lru_cache()
def get_settings():
    return {
        "allowed_origins": os.getenv("ALLOWED_ORIGINS", "*").split(","),
        "api_key": os.getenv("API_KEY", ""),
        "rate_limit": int(os.getenv("RATE_LIMIT_PER_MINUTE", "60")),
        "log_level": os.getenv("LOG_LEVEL", "INFO"),
    }

# =================================
# Logging Setup
# =================================
settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings["log_level"]),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("server.log", mode="a")
    ]
)
logger = logging.getLogger(__name__)

# =================================
# Rate Limiting (Simple in-memory)
# =================================
from collections import defaultdict
import time

class RateLimiter:
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
    
    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        # Clean old requests
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if now - req_time < self.window_seconds
        ]
        # Check limit
        if len(self.requests[client_ip]) >= self.max_requests:
            return False
        # Record this request
        self.requests[client_ip].append(now)
        return True

rate_limiter = RateLimiter(
    max_requests=settings["rate_limit"],
    window_seconds=60
)

# =================================
# API Key Authentication (Optional)
# =================================
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    """Verify API key if configured. Skip if no API key is set."""
    configured_key = settings["api_key"]
    
    # If no API key configured, allow all requests (development mode)
    if not configured_key or configured_key == "dev-api-key-change-in-production":
        return True
    
    # If API key is configured, verify it
    if not api_key or api_key != configured_key:
        logger.warning("Invalid or missing API key")
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    
    return True

# =================================
# FastAPI App
# =================================
app = FastAPI(
    title="Stock Screener API",
    description="API for stock technical ratings with historical tracking",
    version="1.0.0"
)

# CORS Configuration - Use environment variables
allowed_origins = settings["allowed_origins"]
logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# =================================
# Rate Limiting Middleware
# =================================
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    
    if not rate_limiter.is_allowed(client_ip):
        logger.warning(f"Rate limit exceeded for {client_ip}")
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    
    response = await call_next(request)
    return response


# =================================
# API Endpoints
# =================================
@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Stock Screener API is running"}


@app.get("/api/stocks")
def get_stocks(
    market: Optional[str] = Query(None, description="Filter by market: US, TH, HK, JP"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    limit: int = Query(100, ge=1, le=50000, description="Number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    _auth: bool = Depends(verify_api_key)
):
    """
    Get stocks with their 'last different rating'.
    
    Returns stocks with:
    - current_rating: Today's technical rating
    - previous_rating: The most recent rating that was DIFFERENT from current
    - previous_rating_date: When the rating last changed
    - previous_price: Price when the rating last changed
    """
    try:
        stocks = database.get_stocks_with_previous_rating(
            market=market,
            date=date,
            limit=limit,
            offset=offset
        )
        
        logger.debug(f"Fetched {len(stocks)} stocks (market={market}, date={date})")
        
        return {
            "data": stocks,
            "count": len(stocks),
            "filters": {
                "market": market,
                "date": date
            }
        }
    except Exception as e:
        logger.error(f"Error fetching stocks: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stocks")


@app.get("/api/signal-changes")
def get_signal_changes(
    market: Optional[str] = Query(None, description="Filter by market"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    signal_type: Optional[str] = Query(None, description="UPGRADE or DOWNGRADE"),
    _auth: bool = Depends(verify_api_key)
):
    """
    Get only stocks where the rating has changed.
    """
    try:
        changes = database.get_signal_changes(
            market=market,
            date=date,
            signal_type=signal_type
        )
        
        logger.debug(f"Fetched {len(changes)} signal changes")
        
        return {
            "data": changes,
            "count": len(changes),
            "filters": {
                "market": market,
                "date": date,
                "signal_type": signal_type
            }
        }
    except Exception as e:
        logger.error(f"Error fetching signal changes: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch signal changes")


@app.get("/api/dates")
def get_available_dates(_auth: bool = Depends(verify_api_key)):
    """Get list of all dates that have data in the database."""
    try:
        dates = database.get_available_dates()
        return {"dates": dates}
    except Exception as e:
        logger.error(f"Error fetching dates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dates")


@app.get("/api/stock/{symbol}")
def get_stock_history(
    symbol: str,
    days: int = Query(30, ge=1, le=365, description="Number of days of history"),
    _auth: bool = Depends(verify_api_key)
):
    """Get historical ratings for a specific stock."""
    try:
        history = database.get_stock_history(symbol, days)
        return {
            "symbol": symbol,
            "history": history
        }
    except Exception as e:
        logger.error(f"Error fetching stock history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stock history")


@app.get("/api/stats")
def get_stats(_auth: bool = Depends(verify_api_key)):
    """Get database statistics."""
    try:
        return database.get_stats()
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


@app.get("/api/summary")
def get_summary(_auth: bool = Depends(verify_api_key)):
    """Get today's summary statistics for the dashboard cards."""
    try:
        return database.get_today_summary()
    except Exception as e:
        logger.error(f"Error fetching summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch summary")


@app.get("/api/stock/{symbol}/detail")
def get_stock_detail(symbol: str, _auth: bool = Depends(verify_api_key)):
    """
    Get detailed stock information with rating history and computed stats.
    Returns data for the Stock Detail page.
    """
    try:
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
        chronological_history = history[::-1]
        
        signals = []
        
        if chronological_history:
            current_signal = {
                "rating": chronological_history[0].get("technical_rating", "Neutral"),
                "start_date": chronological_history[0].get("fetched_date"),
                "entry_price": chronological_history[0].get("current_price", 0),
                "status": "OPEN"
            }
            
            for entry in chronological_history[1:]:
                entry_rating = entry.get("technical_rating", "Neutral")
                entry_date = entry.get("fetched_date")
                entry_price = entry.get("current_price", 0)
                
                if entry_rating != current_signal["rating"]:
                    # Calculate days held
                    try:
                        start = datetime.strptime(current_signal["start_date"].split(" ")[0], "%Y-%m-%d")
                        end = datetime.strptime(entry_date.split(" ")[0], "%Y-%m-%d")
                        days_held = (end - start).days
                    except Exception:
                        days_held = 0
                    
                    # Calculate profit
                    profit_percent = 0.0
                    if current_signal["entry_price"] > 0:
                        profit_percent = ((entry_price - current_signal["entry_price"]) / current_signal["entry_price"]) * 100
                        
                    signals.append({
                        "date": entry_date,
                        "from_rating": current_signal["rating"],
                        "to_rating": entry_rating,
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
        
        # Reverse signals back to Newest -> Oldest for display
        rating_changes = signals[::-1]
        
        # Calculate Real Stats from these signals
        completed_signals = [s for s in rating_changes if s["status"] == "COMPLETED"]
        total_signals = len(completed_signals)
        
        win_rate = 0
        if total_signals > 0:
            wins = len([s for s in completed_signals if s["result"] > 0.2])
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
        
        # Calculate accuracy stats per signal type
        accuracy_stats = {}
        for signal in completed_signals:
            rating = signal["to_rating"]
            if rating not in accuracy_stats:
                accuracy_stats[rating] = {"wins": 0, "losses": 0}
            
            if signal["result"] > 0.2:
                accuracy_stats[rating]["wins"] += 1
            elif signal["result"] < -0.2:
                accuracy_stats[rating]["losses"] += 1
        
        # Calculate REAL price change from history
        change = 0.0
        change_percent = 0.0
        
        if len(history) > 1:
            prev_entry = history[1]
            prev_price = prev_entry.get("current_price", 0)
            
            if prev_price and prev_price > 0:
                change = current.get("current_price", 0) - prev_price
                change_percent = (change / prev_price) * 100

        logger.debug(f"Fetched detail for {symbol}: {total_signals} signals")

        return {
            "symbol": symbol,
            "name": current.get("name") or (symbol.split(":")[1] if ":" in symbol else symbol),
            "market": current.get("market") or (symbol.split(":")[0] if ":" in symbol else ""),
            "current_price": current.get("current_price", 0),
            "current_rating": current.get("technical_rating", "N/A"),
            "change": change,
            "change_percent": change_percent,
            "stats": stats,
            "accuracy_stats": accuracy_stats,
            "history": rating_changes
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching stock detail for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stock detail")


@app.get("/api/stocks/by-rating")
def get_stocks_by_rating(
    rating: str = Query(..., description="Rating to filter by: Strong Buy, Buy, Strong Sell, Sell"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    limit: int = Query(1000, ge=1, le=5000, description="Number of results"),
    _auth: bool = Depends(verify_api_key)
):
    """
    Get all stocks with a specific current rating.
    Used for the popup when clicking on signal labels.
    """
    try:
        stocks = database.get_stocks_by_rating(
            rating=rating,
            date=date,
            limit=limit
        )
        
        logger.debug(f"Fetched {len(stocks)} stocks with rating={rating}")
        
        return {
            "data": stocks,
            "count": len(stocks),
            "rating": rating,
            "date": date
        }
    except Exception as e:
        logger.error(f"Error fetching stocks by rating: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stocks by rating")


if __name__ == "__main__":

    import uvicorn
    
    port = int(os.getenv("API_PORT", "8000"))
    
    logger.info(f"Starting Stock Screener API Server on port {port}...")
    logger.info(f"API docs available at: http://localhost:{port}/docs")
    
    # Enable reload for development
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
