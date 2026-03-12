import logging
from typing import Optional

from fastapi import APIRouter, Query, HTTPException, Request, Depends, Response

import database
from api.dependencies import verify_api_key, settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Stocks"])

# Helper function from server.py to get market open times
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


@router.get("/stocks")
def get_stocks(
    request: Request,
    response: Response,
    market: Optional[str] = Query(None, description="Filter by market: US, TH, HK, JP"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    search: Optional[str] = Query(None, description="Search term for symbol or name"),
    rating: Optional[str] = Query(None, description="Filter by rating: Strong Buy, Buy, Sell, Strong Sell"),
    technical_rating: Optional[str] = Query(None, description="Filter by technical rating group: Positive or Negative"),
    sectors: Optional[str] = Query(None, description="Comma-separated sectors to filter"),
    previous_rating: Optional[str] = Query(None, description="Filter by previous rating: Strong Buy, Buy, Sell, Strong Sell"),
    sort_by: str = Query('fetched_date', description="Sort by: symbol, current_price, change, changePercent, fetched_date"),
    sort_order: str = Query('desc', description="Sort order: asc or desc"),
    limit: int = Query(100, ge=1, le=50000, description="Number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    lookback: Optional[int] = Query(None, description="Lookback days for historical data (Null for infinite)"),
    breakout_scores: Optional[str] = Query(None, description="Comma-separated breakout scores to filter, e.g. '0,1,2,3,4'"),
    pinned_symbols: Optional[str] = Query(None, description="Comma-separated list of symbols to pin at top, e.g. 'NASDAQ:AAPL,HKEX:1065'"),
    _auth: bool = Depends(verify_api_key)
):
    """
    Get stocks with their 'last different rating'.
    """
    if market == "All":
        market = None
        
    if search:
        logger.info(f"🔍 SEARCH REQUEST: term='{search}', market={market}, rating={rating}, limit={limit}")

    pinned_list = [s.strip() for s in pinned_symbols.split(",") if s.strip()] if pinned_symbols else None
    sectors_list = [s.strip() for s in sectors.split(",") if s.strip()] if sectors else None
    breakout_scores_list = [int(s.strip()) for s in breakout_scores.split(",") if s.strip()] if breakout_scores else None

    # Retrieve limit from app state (injected by slowapi middleware in server.py)
    # The literal decorator isn't actually needed here if slowapi is applied globally or carefully in the router mapping
    # But since @limiter.limit requires access to request, and we moved endpoints, 
    # we need to make sure rate limiting works. 
    # For now, we apply rate limits in the router endpoints by importing 'limiter' or letting global middleware handle it.
    # Standard SlowAPI routing requires `@limiter.limit("rate")` on the endpoints.
    # To avoid circular imports, we will apply limiter at the `include_router` level or inject it later.
    # Note: I omitted `@limiter.limit` here but will ensure it functions via FastAPI's global middlewares if possible or apply it in server.py

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
            offset=offset,
            lookback_days=lookback,
            sectors=sectors_list,
            previous_rating=previous_rating,
            pinned_symbols=pinned_list,
            breakout_scores=breakout_scores_list
        )
        
        total_count = database.get_stocks_count(
            market=market,
            date=date,
            search=search,
            rating=rating,
            technical_rating=technical_rating,
            lookback_days=lookback,
            sectors=sectors_list,
            previous_rating=previous_rating,
            breakout_scores=breakout_scores_list
        )

        logger.debug(f"Fetched {len(stocks)} stocks out of {total_count} total")
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
        
        return {
            "data": stocks,
            "count": len(stocks),
            "total": total_count,
            "filters": {
                "market": market,
                "date": date,
                "rating": rating,
                "technical_rating": technical_rating,
                "sectors": sectors
            }
        }
    except Exception as e:
        logger.error(f"Error fetching stocks: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stocks")


@router.get("/stocks/by-rating")
def get_stocks_by_rating(
    rating: str = Query(..., description="Rating to filter by: Strong Buy, Buy, Strong Sell, Sell"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    limit: int = Query(1000, ge=1, le=5000, description="Number of results"),
    _auth: bool = Depends(verify_api_key)
):
    """
    Get all stocks with a specific current rating.
    """
    try:
        stocks = database.get_stocks_by_rating(rating=rating, date=date, limit=limit)
        return {
            "data": stocks,
            "count": len(stocks),
            "rating": rating,
            "date": date
        }
    except Exception as e:
        logger.error(f"Error fetching stocks by rating: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stocks by rating")


@router.get("/stock/{symbol}")
def get_stock_history(
    symbol: str,
    days: int = Query(30, ge=1, le=365, description="Number of days of history"),
    _auth: bool = Depends(verify_api_key)
):
    """Get historical ratings for a specific stock."""
    try:
        history = database.get_stock_history(symbol, days)
        return {"symbol": symbol, "history": history}
    except Exception as e:
        logger.error(f"Error fetching stock history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stock history")


@router.get("/stock/{symbol}/detail")
def get_stock_detail(symbol: str, _auth: bool = Depends(verify_api_key)):
    """
    Get detailed stock information with rating history and computed stats.
    Returns data for the Stock Detail page.
    """
    try:
        # Get all history for this stock
        history = database.get_stock_pre_market_history(symbol, limit=365)
        if len(history) < 2:
            history = database.get_stock_history(symbol, days=365)
        
        if not history:
            raise HTTPException(status_code=404, detail=f"Stock symbol '{symbol}' not found in database")
        
        current = history[0] if history else {}
        
        # Accuracy metrics from latest_stock_ratings
        latest_res = database.get_client().table("latest_stock_ratings").select("accuracy_percent, total_signals, sector, industry").eq("symbol", symbol).execute()
        
        db_accuracy = latest_res.data[0].get("accuracy_percent") if latest_res.data else None
        db_total_signals = latest_res.data[0].get("total_signals") if latest_res.data else 0
        db_sector = latest_res.data[0].get("sector") if latest_res.data and latest_res.data[0].get("sector") else None
        db_industry = latest_res.data[0].get("industry") if latest_res.data and latest_res.data[0].get("industry") else None
        
        # Signals from signal_returns
        signals_res = database.get_client().table("signal_returns").select("*").eq("symbol", symbol).order("signal_date", desc=True).execute()
        signals_data = signals_res.data or []
        signals = []
        
        for i, s in enumerate(signals_data):
            if s.get("to_rating") == "Neutral" or s.get("from_rating") == "Neutral":
                continue

            is_active = s["status"] == "active" and s["exit_price"] is None
            if not is_active and i > 0:
                exit_date = signals_data[i-1]["signal_date"]
            else:
                exit_date = s.get("return_1d_calculated_at")[:10] if not is_active and s.get("return_1d_calculated_at") else s["signal_date"]
            
            signals.append({
                "date": exit_date, 
                "start_date": s["signal_date"], 
                "start_time": None, 
                "end_time": None,
                "from_rating": s["from_rating"] or "N/A",
                "to_rating": s["to_rating"],
                "open_price_d1": s["signal_entry_price"],
                "open_price_d2": s["exit_price"],
                "days_held": 1 if not is_active else 0,
                "result": s["return_1d"],
                "status": "COMPLETED" if not is_active else "OPEN"
            })

        rating_changes = signals[:50]
        
        completed_signals = [s for s in signals if s["status"] == "COMPLETED"]
        total_signals = len(completed_signals)
        
        win_rate = 0
        if total_signals > 0:
            wins = len([s for s in completed_signals if (s["result"] or 0) > 0.2])
            win_rate = (wins / total_signals) * 100
            
        avg_return = 0
        if total_signals > 0:
            avg_return = sum((s["result"] or 0) for s in completed_signals) / total_signals

        stats = {
            "total_signals": total_signals,
            "win_rate": win_rate,
            "avg_return": avg_return,
            "best_return": max([(s["result"] or 0) for s in completed_signals]) if completed_signals else 0
        }
        
        accuracy_stats = {}
        for signal in completed_signals:
            rating = signal["to_rating"]
            if rating == "Neutral":
                continue
            if rating not in accuracy_stats:
                accuracy_stats[rating] = {"wins": 0, "losses": 0}
            
            res = signal["result"] or 0
            if res > 0.2:
                accuracy_stats[rating]["wins"] += 1
            elif res < -0.2:
                accuracy_stats[rating]["losses"] += 1
        
        change = 0.0
        change_percent = 0.0
        if len(history) > 1:
            prev_entry = history[1]
            prev_price = prev_entry.get("current_price", 0)
            if prev_price and prev_price > 0:
                change = current.get("current_price", 0) - prev_price
                change_percent = (change / prev_price) * 100

        # Intraday Logic
        intraday_data = database.get_latest_intraday_records(symbol)
        intraday_moves = []
        if intraday_data and intraday_data.get("today_records"):
            today_recs = intraday_data["today_records"]
            prev_rec = intraday_data["prev_record"]
            
            if prev_rec:
                first_rec = today_recs[0]
                if prev_rec["technical_rating"] != "Neutral" and first_rec["technical_rating"] != "Neutral":
                    if prev_rec["technical_rating"].lower() != first_rec["technical_rating"].lower():
                        try:
                            start_price = first_rec.get("open") or first_rec["current_price"]
                            end_price = first_rec["current_price"]
                            res_pct = ((end_price - start_price) / start_price * 100) if start_price > 0 else 0
                            intraday_moves.append({
                                "date": first_rec["fetched_date"],
                                "start_time": get_market_open_time(first_rec["market"]),
                                "end_time": first_rec["fetched_time"], 
                                "from_rating": prev_rec["technical_rating"],
                                "to_rating": first_rec["technical_rating"],
                                "entry_price": start_price,
                                "exit_price": end_price,
                                "result": res_pct,
                                "status": "COMPLETED"
                            })
                        except Exception:
                            pass
            
            for i in range(len(today_recs) - 1):
                rec_a = today_recs[i]
                rec_b = today_recs[i+1]
                if rec_a["technical_rating"] == "Neutral" or rec_b["technical_rating"] == "Neutral":
                    continue
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
            
            if not intraday_moves and len(today_recs) >= 1:
                 rec = today_recs[-1]
                 from_rating = prev_rec["technical_rating"] if prev_rec else "Neutral"
                 to_rating = rec["technical_rating"]
                 if to_rating != "Neutral" and from_rating != "Neutral" and from_rating.lower() != to_rating.lower():
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

        sector_val = db_sector or "-"
        industry_val = db_industry or "-"
        if sector_val == "-" or industry_val == "-":
            for h in history:
                if sector_val == "-" and h.get("sector") and h.get("sector") != "-":
                    sector_val = h.get("sector")
                if industry_val == "-" and h.get("industry") and h.get("industry") != "-":
                    industry_val = h.get("industry")
                if sector_val != "-" and industry_val != "-":
                    break

        return {
            "symbol": symbol,
            "name": current.get("name") or (symbol.split(":")[1] if ":" in symbol else symbol),
            "market": current.get("market") or (symbol.split(":")[0] if ":" in symbol else ""),
            "sector": sector_val,
            "industry": industry_val,
            "current_price": current.get("current_price", 0),
            "current_rating": "N/A" if current.get("technical_rating", "N/A") == "Neutral" else current.get("technical_rating", "N/A"),
            "change": change,
            "change_percent": change_percent,
            "accuracy_percent": db_accuracy,
            "total_signals": db_total_signals,
            "stats": stats,
            "accuracy_stats": accuracy_stats,
            "intraday_moves": intraday_moves[::-1],
            "history": rating_changes,
            "pre_market_history": database.get_stock_pre_market_history(symbol, limit=2)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching stock detail for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stock detail")
