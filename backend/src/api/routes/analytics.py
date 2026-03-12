import logging
from typing import Optional

from fastapi import APIRouter, Query, HTTPException, Depends

import database
from api.dependencies import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analytics"])


@router.get("/stats")
def get_stats(_auth: bool = Depends(verify_api_key)):
    """Get database statistics."""
    try:
        return database.get_stats()
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


@router.get("/summary")
def get_summary(
    market: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    _auth: bool = Depends(verify_api_key)
):
    """Get today's summary statistics for the dashboard cards."""
    if market == "All":
        market = None
        
    try:
        return database.get_today_summary(market=market, date=date)
    except Exception as e:
        logger.error(f"Error fetching summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch summary")


@router.get("/signal-changes")
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


@router.get("/analytics/signal-performance")
async def get_signal_performance(
    rating: Optional[str] = Query(None, description="Filter by rating"),
    market: Optional[str] = Query(None, description="Filter by market"),
    period: int = Query(1, description="Period: 1, 10, or 30 days")
):
    """Analyze signal performance with filters"""
    try:
        client = database.get_client()
        
        if period not in [1, 10, 30]:
            raise HTTPException(status_code=400, detail="Period must be 1, 10, or 30")
        
        valid_ratings = ['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell']
        if rating and rating not in valid_ratings:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid rating '{rating}'. Must be one of: {', '.join(valid_ratings)}"
            )
        
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

@router.get("/analytics/rating-comparison")
async def get_rating_comparison(
    period: int = Query(1, description="Period: 1, 10, or 30 days"),
    market: Optional[str] = Query(None, description="Filter by market")
):
    """Compare performance across all ratings"""
    try:
        client = database.get_client()
        
        if period not in [1, 10, 30]:
            raise HTTPException(status_code=400, detail="Period must be 1, 10, or 30")
        
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

@router.get("/analytics/stock-signals/{symbol}")
async def get_stock_signals(symbol: str):
    """
    Get all signal history for a specific stock with prices and returns
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
                "price_after_1d": s.get("price_after_1d"),
                "price_after_10d": s.get("price_after_10d"),
                "price_after_30d": s.get("price_after_30d"),
                "return_1d": s.get("return_1d"),
                "return_10d": s.get("return_10d"),
                "return_30d": s.get("return_30d"),
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
