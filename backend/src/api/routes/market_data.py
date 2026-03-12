import logging

from fastapi import APIRouter, HTTPException, Depends

import database
from api.dependencies import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Market Data"])


@router.get("/dates")
def get_available_dates(_auth: bool = Depends(verify_api_key)):
    """Get list of all dates that have data in the database."""
    try:
        dates = database.get_available_dates()
        return {"dates": dates}
    except Exception as e:
        logger.error(f"Error fetching dates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dates")


@router.get("/sectors")
def get_sectors(_auth: bool = Depends(verify_api_key)):
    """Get list of all available sectors."""
    try:
        sectors = database.get_unique_sectors()
        return {"sectors": sectors}
    except Exception as e:
        logger.error(f"Error fetching sectors: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch sectors")


@router.get("/breakout-scores")
def get_breakout_scores(_auth: bool = Depends(verify_api_key)):
    """Get list of all available breakout scores."""
    try:
        breakout_scores = database.get_unique_breakout_scores()
        return {"breakout_scores": breakout_scores}
    except Exception as e:
        logger.error(f"Error fetching breakout scores: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch breakout scores")
