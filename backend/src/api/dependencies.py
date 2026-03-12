import os
import logging
from functools import lru_cache
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

logger = logging.getLogger(__name__)

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

settings = get_settings()

# =================================
# API Key Authentication
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
