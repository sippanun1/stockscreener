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

# Market open times (local time for each market)
def get_market_open_time(market: str) -> str:
    """Get market open time for each market"""
    market_times = {
        "TH": "10:00",  # Thailand
        "US": "09:30",  # United States
        "HK": "09:30",  # Hong Kong
        "JP": "09:00",  # Japan
        "IN": "09:15",  # India
        "VN": "09:00",  # Vietnam
        "UK": "08:00",  # United Kingdom
    }
    return market_times.get(market.upper(), "09:00")

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
    search: Optional[str] = Query(None, description="Search term for symbol or name"),
    rating: Optional[str] = Query(None, description="Filter by rating: Strong Buy, Buy, Sell, Strong Sell"),
    technical_rating: Optional[str] = Query(None, description="Filter by technical rating group: Positive or Negative"),
    sort_by: str = Query('fetched_date', description="Sort by: symbol, current_price, change, changePercent, fetched_date"),
    sort_order: str = Query('desc', description="Sort order: asc or desc"),
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
    - total: Total count in database matching filters (excludes price < 0.2, OTC)
    """
    # Fix: Convert "All" to None for SQL
    if market == "All":
        market = None
        
    try:
        stocks = database.get_stocks_with_previous_rating(
            market=market,
            date=date,
            search=search,
            rating=rating,
            technical_rating=technical_rating,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset
        )
        
        # Get total count matching the same filters (for "Total Signal" display)
        total_count = database.get_stocks_count(
            market=market,
            date=date,
            search=search,
            rating=rating,
            technical_rating=technical_rating
        )
        
        logger.debug(f"Fetched {len(stocks)} stocks out of {total_count} total (market={market}, date={date}, technical_rating={technical_rating})")
        
        return {
            "data": stocks,
            "count": len(stocks),
            "total": total_count,
            "filters": {
                "market": market,
                "date": date,
                "rating": rating,
                "technical_rating": technical_rating
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
def get_summary(
    market: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    _auth: bool = Depends(verify_api_key)
):
    """Get today's summary statistics for the dashboard cards."""
    # Fix: Convert "All" to None for SQL
    if market == "All":
        market = None
        
    try:
        return database.get_today_summary(market=market, date=date)
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
        # Get all history for this stock (Using Pre-Market for Open-to-Open logic)
        history = database.get_stock_pre_market_history(symbol, limit=365)
        
        # Fallback to Post-Market if Pre-Market data is insufficient (need at least 2 for signals)
        if len(history) < 2:
            history = database.get_stock_history(symbol, days=365)
        
        if not history:
            raise HTTPException(
                status_code=404,
                detail=f"Stock symbol '{symbol}' not found in database"
            )
        
        # Get current info from most recent entry
        current = history[0] if history else {}
        
        # Process history Chronologically (Oldest -> Newest) to find signals
        # Filter out Neutral ratings to skip them (bridge signals)
        raw_history = history[::-1]
        chronological_history = [entry for entry in raw_history if entry.get("technical_rating") != "Neutral"]
        
        signals = []
        
        if chronological_history:
            # We need to treat every signal change as a potential 1-day trade
            # D1 = The day the rating changed (or started)
            # D2 = The NEXT available trading day
            
            # Start from the first available record
            for i in range(len(chronological_history)):
                entry = chronological_history[i]
                current_rating = entry.get("technical_rating", "Neutral")
                
                # We need to determine if this is a "Signal Change"
                # For the very first record, we assume it's a start
                is_signal_change = False
                prev_rating = "Neutral"
                
                if i == 0:
                    is_signal_change = True
                    # If it's the first record, previous is explicitly unknown/neutral, so we take it.
                else:
                    prev_entry = chronological_history[i-1]
                    prev_rating = prev_entry.get("technical_rating", "Neutral")
                    if current_rating != prev_rating:
                        is_signal_change = True
                
                # If this is a new signal (Entry Day / D1)
                if is_signal_change and current_rating != "Neutral":
                    raw_entry_date = entry.get("fetched_date")
                    entry_date = raw_entry_date[:10]  # Normalize to YYYY-MM-DD (handle ISO timestamps in DB)
                    entry_time = entry.get("fetched_time")
                    # Use Official Open if available, else fallback to current_price (Safe for old data)
                    entry_price = entry.get("open") or entry.get("current_price", 0)
                    
                    # Look for D2 (The next record representing a NEW CALENDAR DAY)
                    # FIX: Use raw_history (includes Neutrals) to just get the very next trading day
                    exit_entry = None
                    
                    # We need to find where 'entry' is in raw_history to start searching after it
                    # (Or just search by date since raw_history is sorted)
                    # raw_history is Newest -> Oldest. 
                    # We want the record immediately OLDER than current? No, we processed 'chronological_history' which is Oldest -> Newest (reversed at line 297)
                    # Wait, let's look at line 303: raw_history = history[::-1]  <-- raw_history is OLDEST -> NEWEST.
                    # So we can just iterate raw_history.
                    
                    for candidate in raw_history:
                        candidate_raw_date = candidate.get("fetched_date")
                        candidate_date = candidate_raw_date[:10] # Normalize
                        
                        # Find the first date strictly greater than entry date
                        if candidate_date > entry_date:
                            exit_entry = candidate
                            break # Found the immediate next trading day
                    
                    if exit_entry:
                        exit_date = exit_entry.get("fetched_date") # Keep original for frontend parsing
                        # exit_price is the OPEN of the next day (Daily Strategy)
                        exit_price = exit_entry.get("open") or exit_entry.get("current_price", 0)
                        
                        # Calculate Result (D1 -> D2)
                        profit_percent = 0.0
                        if entry_price > 0:
                            profit_percent = ((exit_price - entry_price) / entry_price) * 100
                            
                        signals.append({
                            "date": exit_date, 
                            "start_date": raw_entry_date,
                            "start_time": entry_time,
                            "end_time": exit_entry.get("fetched_time"),
                            "from_rating": prev_rating if i > 0 else "N/A",
                            "to_rating": current_rating,
                            "open_price_d1": entry_price,
                            "open_price_d2": exit_price,
                            "days_held": 1,
                            "result": profit_percent,
                            "status": "COMPLETED"
                        })
                    else:
                        # This is the LATEST record (Open trade, waiting for tomorrow)
                        signals.append({
                            "date": raw_entry_date,
                            "start_date": raw_entry_date,
                            "start_time": entry_time,
                            "end_time": None,
                            "from_rating": prev_rating if i > 0 else "N/A",
                            "to_rating": current_rating,
                            "open_price_d1": entry_price,
                            "open_price_d2": None,
                            "days_held": 0,
                            "result": None,
                            "status": "OPEN"
                        })

        # Reverse signals back to Newest -> Oldest for display and LIMIT to 10
        rating_changes = signals[::-1][:10]
        
        # Calculate Real Stats from these signals (use ALL signals for stats? User said "limit history", ambiguous if stats should reflect all time or just displayed)
        # Usually stats reflect "All Time" but history list is paginated. 
        # But if the user wants "limit to 10", maybe they just want to see the last 10.
        # Let's keep stats based on the *fetched* signals (which is all history) to be accurate.
        stats_signals = signals
        
        completed_signals = [s for s in stats_signals if s["status"] == "COMPLETED"]
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

        # --- NEW INTRADAY LOGIC ---
        # Get Real Intraday Moves (Today's activity)
        # Note: We need symbol from somewhere. It's passed as arg.
        intraday_data = database.get_latest_intraday_records(symbol)
        intraday_moves = []
        
        if intraday_data and intraday_data.get("today_records"):
            today_recs = intraday_data["today_records"]
            prev_rec = intraday_data["prev_record"]
            
            # 1. Overnight Move (Prev Close -> First Today)
            if prev_rec:
                first_rec = today_recs[0]
                
                # Check for Neutral ratings and skip if present
                if prev_rec["technical_rating"] != "Neutral" and first_rec["technical_rating"] != "Neutral":
                    # ONLY show if rating changed (Case-insensitive)
                    if prev_rec["technical_rating"].lower() != first_rec["technical_rating"].lower():
                        try:
                            # Use today's open price as entry (not yesterday's close)
                            start_price = first_rec.get("open") or first_rec["current_price"]
                            end_price = first_rec["current_price"]
                            res_pct = ((end_price - start_price) / start_price * 100) if start_price > 0 else 0
                            
                            intraday_moves.append({
                                "date": first_rec["fetched_date"],
                                "start_time": get_market_open_time(first_rec["market"]), # Use market open time
                                "end_time": first_rec["fetched_time"], 
                                "from_rating": prev_rec["technical_rating"],
                                "to_rating": first_rec["technical_rating"],
                                "entry_price": start_price,
                                "exit_price": end_price, # Current price at that moment
                                "result": res_pct,
                                "status": "COMPLETED"
                            })
                        except Exception:
                            pass
            
            # 2. Intraday Moves (Record A -> Record B)
            for i in range(len(today_recs) - 1):
                rec_a = today_recs[i]
                rec_b = today_recs[i+1]
                
                # Skip if either rating is Neutral
                if rec_a["technical_rating"] == "Neutral" or rec_b["technical_rating"] == "Neutral":
                    continue
                
                # ONLY show if rating changed (Case-insensitive)
                if rec_a["technical_rating"].lower() != rec_b["technical_rating"].lower():
                    try:
                        start_price = rec_a["current_price"]
                        end_price = rec_b["current_price"]
                        res_pct = ((end_price - start_price) / start_price * 100) if start_price > 0 else 0
                        
                        intraday_moves.append({
                            "date": rec_b["fetched_date"],
                            "start_time": rec_a["fetched_time"], 
                            "end_time": rec_b["fetched_time"],
                            "from_rating": rec_a["technical_rating"],
                            "to_rating": rec_b["technical_rating"],
                            "entry_price": start_price,
                            "exit_price": end_price,
                            "result": res_pct,
                            "status": "COMPLETED"
                        })
                    except Exception:
                        pass
            
            # 3. If no moves were recorded today but a record exists, 
            # check if it's a change from Yesterday's last record.
            if not intraday_moves and len(today_recs) >= 1:
                 rec = today_recs[-1] # Most recent today
                 from_rating = prev_rec["technical_rating"] if prev_rec else "Neutral"
                 to_rating = rec["technical_rating"]
                 
                 # Only show as an OPEN record if it's a CHANGE from yesterday or a fresh signal
                 if to_rating != "Neutral" and from_rating.lower() != to_rating.lower():
                     intraday_moves.append({
                        "date": rec["fetched_date"],
                        "start_time": rec["fetched_time"],
                        "end_time": None,
                        "from_rating": from_rating,
                        "to_rating": to_rating,
                        "entry_price": rec["current_price"],
                        "exit_price": None,
                        "result": None,
                        "status": "OPEN"
                    })

        logger.debug(f"Fetched detail for {symbol}: {total_signals} signals")

        return {
            "symbol": symbol,
            "name": current.get("name") or (symbol.split(":")[1] if ":" in symbol else symbol),
            "market": current.get("market") or (symbol.split(":")[0] if ":" in symbol else ""),
            "current_price": current.get("current_price", 0),
            "current_rating": "N/A" if current.get("technical_rating", "N/A") == "Neutral" else current.get("technical_rating", "N/A"),
            "change": change,
            "change_percent": change_percent,
            "stats": stats,
            "accuracy_stats": accuracy_stats,
            "intraday_moves": intraday_moves[::-1], # New Intraday Data (Newest First)
            "history": rating_changes,
            "pre_market_history": database.get_stock_pre_market_history(symbol, limit=2)
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


@app.get("/api/intraday")
async def get_intraday_changes(
    request: Request,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    market: Optional[str] = Query(None, description="Market filter (US, HK, TH, JP)"),
    api_key: bool = Depends(verify_api_key)
):
    """
    Get stocks with intraday changes (pre-open vs regular market).
    Returns stocks where rating changed between sessions.
    """
    if not rate_limiter.is_allowed(request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        # Use today if no date specified
        # if not date:
        #    date = datetime.now().strftime("%Y-%m-%d")
            
        # Use helper function
        results = database.get_intraday_comparison(date, market)
        
        return {
            "date": date,
            "market": market or "All",
            "count": len(results),
            "data": results
        }
        
    except Exception as e:
        logger.error(f"Error fetching intraday changes: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch intraday changes")


@app.get("/api/stock/{symbol}/intraday")
async def get_stock_intraday(
    symbol: str,
    request: Request,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    api_key: bool = Depends(verify_api_key)
):
    """
    Get intraday data for a specific stock (pre-open vs regular).
    """
    if not rate_limiter.is_allowed(request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    try:
        # Fetch directly from Supabase via helper
        # Note: get_latest_intraday_records currently fetches the "Latest" available date.
        # If a specific date is requested, we might need a new helper or just filter here?
        # For now, let's trust the helper or strictly use client if date is provided.
        
        # Actually, let's just use the Supabase client directly here for flexibility
        client = database.get_client()
        query = client.table("stock_ratings").select("*").eq("symbol", symbol)
        
        if date:
            query = query.eq("fetched_date", date)
        else:
            # If no date, get latest date first? Or just order by desc limit 20
            # Let's order by date desc, time desc to get latest sessions
            pass
            
        # Fetch last 50 records (enough for a few days of sessions)
        response = query.order("fetched_date", desc=True).order("fetched_time", desc=True).limit(50).execute()
        
        rows = response.data
        
        if not rows:
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")
        
        # If date was not provided, infer the latest date from the data
        target_date = date if date else rows[0]["fetched_date"]
        
        # Filter rows for this date only
        day_rows = [r for r in rows if r["fetched_date"] == target_date]
        
        # Sort by time ASC for the graph/list
        day_rows.sort(key=lambda x: x["fetched_time"])
        
        result = {
            "symbol": symbol,
            "market": day_rows[0]["market"] if day_rows else "",
            "name": day_rows[0]["name"] if day_rows else "",
            "date": target_date,
            "sessions": []
        }
        
        for row in day_rows:
            result["sessions"].append({
                "type": row["session_type"],
                "rating": "N/A" if row["technical_rating"] == "Neutral" else row["technical_rating"],
                "price": row["current_price"],
                "score": row["technical_score"],
                "time": row["fetched_time"]
            })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching stock intraday data: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stock intraday data")



# =================================
# Analytics API - Signal Performance
# =================================
@app.get("/api/analytics/signal-performance")
async def get_signal_performance(
    rating: Optional[str] = Query(None, description="Filter by rating"),
    market: Optional[str] = Query(None, description="Filter by market"),
    period: int = Query(1, description="Period: 1, 10, or 30 days")
):
    """Analyze signal performance with filters"""
    try:
        client = database.get_client()
        
        # Validate period
        if period not in [1, 10, 30]:
            raise HTTPException(status_code=400, detail="Period must be 1, 10, or 30")
        
        # Validate rating
        valid_ratings = ['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell']
        if rating and rating not in valid_ratings:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid rating '{rating}'. Must be one of: {', '.join(valid_ratings)}"
            )
        
        # Validate market
        valid_markets = ['US', 'TH', 'HK', 'JP', 'IN', 'VN', 'UK']
        if market and market not in valid_markets:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid market '{market}'. Must be one of: {', '.join(valid_markets)}"
            )
        
        query = client.table("signal_returns").select("*")
        if rating:
            query = query.eq("to_rating", rating)
        if market:
            query = query.eq("market", market)
        
        return_col = f"return_{period}d"
        query = query.not_.is_(return_col, "null")
        result = query.execute()
        
        if not result.data:
            # Improved error message for empty data
            if period == 30:
                message = f"No {period}-day data available yet. Signals need {period} trading days to calculate returns."
            else:
                message = "No data matching the specified filters."
            return {"total_signals": 0, "message": message}
        
        returns = [s[return_col] for s in result.data]
        wins = [r for r in returns if r > 0.2]
        sorted_returns = sorted(returns)
        
        return {
            "rating": rating or "All",
            "market": market or "All",
            "period": period,
            "total_signals": len(returns),
            "avg_return": round(sum(returns) / len(returns), 2),
            "median_return": round(sorted_returns[len(sorted_returns)//2], 2),
            "win_rate": round(len(wins) / len(returns) * 100, 2),
            "best_return": round(max(returns), 2),
            "worst_return": round(min(returns), 2)
        }
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/rating-comparison")
async def get_rating_comparison(
    period: int = Query(1, description="Period: 1, 10, or 30 days"),
    market: Optional[str] = Query(None, description="Filter by market")
):
    """Compare performance across all ratings"""
    try:
        client = database.get_client()
        
        # Validate period
        if period not in [1, 10, 30]:
            raise HTTPException(status_code=400, detail="Period must be 1, 10, or 30")
        
        # Validate market
        valid_markets = ['US', 'TH', 'HK', 'JP', 'IN', 'VN', 'UK']
        if market and market not in valid_markets:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid market '{market}'. Must be one of: {', '.join(valid_markets)}"
            )
        
        query = client.table("signal_returns").select(f"to_rating, return_{period}d")
        if market:
            query = query.eq("market", market)
        query = query.not_.is_(f"return_{period}d", "null")
        result = query.execute()
        
        ratings_data = {}
        for signal in result.data:
            rating = signal["to_rating"]
            ret = signal[f"return_{period}d"]
            if rating not in ratings_data:
                ratings_data[rating] = []
            ratings_data[rating].append(ret)
        
        comparison = []
        for rating, returns in ratings_data.items():
            wins = [r for r in returns if r > 0.2]
            comparison.append({
                "rating": rating,
                "signals": len(returns),
                "avg_return": round(sum(returns) / len(returns), 2),
                "win_rate": round(len(wins) / len(returns) * 100, 2)
            })
        
        comparison.sort(key=lambda x: x["avg_return"], reverse=True)
        return {"period": period, "market": market or "All", "ratings": comparison}
    except Exception as e:
        logger.error(f"Comparison error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/stock-signals/{symbol}")
async def get_stock_signals(symbol: str):
    """
    Get all signal history for a specific stock with prices and returns
    
    Example: /api/analytics/stock-signals/NASDAQ:AAPL
    """
    try:
        client = database.get_client()
        
        result = client.table("signal_returns")\
            .select("*")\
            .eq("symbol", symbol)\
            .order("signal_date", desc=True)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"No signals found for {symbol}")
        
        signals = []
        for s in result.data:
            signals.append({
                "signal_date": s["signal_date"],
                "from_rating": s["from_rating"],
                "to_rating": s["to_rating"],
                "signal_entry_price": s["signal_entry_price"],
                
                # Prices
                "price_after_1d": s.get("price_after_1d"),
                "price_after_10d": s.get("price_after_10d"),
                "price_after_30d": s.get("price_after_30d"),
                
                # Returns
                "return_1d": s.get("return_1d"),
                "return_10d": s.get("return_10d"),
                "return_30d": s.get("return_30d"),
                
                # Calculated timestamps
                "return_1d_calculated_at": s.get("return_1d_calculated_at"),
                "return_10d_calculated_at": s.get("return_10d_calculated_at"),
                "return_30d_calculated_at": s.get("return_30d_calculated_at")
            })
        
        return {
            "symbol": symbol,
            "market": result.data[0]["market"],
            "total_signals": len(signals),
            "signals": signals
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching stock signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":

    import uvicorn
    
    port = int(os.getenv("API_PORT", "8000"))
    
    logger.info(f"Starting Stock Screener API Server on port {port}...")
    logger.info(f"API docs available at: http://localhost:{port}/docs")
    
    # Enable reload for development
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
