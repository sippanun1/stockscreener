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

from fastapi import FastAPI, Query, HTTPException, Request, Depends, Security, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
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
# Rate Limiting (Production Ready)
# =================================
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Initialize the limiter using the client's IP address
limiter = Limiter(key_func=get_remote_address)

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

# Register the slowapi rate limiter Exception Handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

# Add GZip compression for large JSON payloads
app.add_middleware(GZipMiddleware, minimum_size=1000)

# =================================
# Rate Limiting Middleware
# =================================
# Use SlowAPI's official middleware instead of the custom http wrapper
app.add_middleware(SlowAPIMiddleware)


# =================================
# API Endpoints
# =================================
@app.get("/")
@limiter.limit("10/minute")
def root(request: Request):
    """Health check endpoint."""
    return {"status": "ok", "message": "Stock Screener API is running"}


# =================================
# API Routes Registration
# =================================
from api.routes import stocks, analytics, market_data, intraday

app.include_router(stocks.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(market_data.router, prefix="/api")
app.include_router(intraday.router, prefix="/api")



if __name__ == "__main__":

    import uvicorn
    
    port = int(os.getenv("API_PORT", "8000"))
    
    logger.info(f"Starting Stock Screener API Server on port {port}...")
    logger.info(f"API docs available at: http://localhost:{port}/docs")
    
    # Enable reload for development
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
