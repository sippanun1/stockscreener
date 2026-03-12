import logging
from typing import Optional

from fastapi import APIRouter, Query, HTTPException, Request, Depends

import database
from api.dependencies import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Intraday"])

# Note: The original server.py endpoints for intraday had a rate_limiter dependency 
# applied via `if not rate_limiter.is_allowed(request.client.host)`.
# Since we are using SlowAPI middleware, the `@limiter.limit` decorator or global middleware handles it.
# We will rely on the global SlowAPIMiddleware configured in server.py.


@router.get("/intraday")
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
    try:
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


@router.get("/stock/{symbol}/intraday")
async def get_stock_intraday(
    symbol: str,
    request: Request,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    api_key: bool = Depends(verify_api_key)
):
    """
    Get intraday data for a specific stock (pre-open vs regular).
    """
    try:
        client = database.get_client()
        query = client.table("stock_ratings").select("*").eq("symbol", symbol)
        
        if date:
            query = query.eq("fetched_date", date)
            
        response = query.order("fetched_date", desc=True).order("fetched_time", desc=True).limit(50).execute()
        
        rows = response.data
        
        if not rows:
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")
        
        target_date = date if date else rows[0]["fetched_date"]
        day_rows = [r for r in rows if r["fetched_date"] == target_date]
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
