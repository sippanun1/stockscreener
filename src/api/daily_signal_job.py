#!/usr/bin/env python3
"""
Daily job: Detect new signals + Calculate pending returns
Run at 6:00 AM daily (after all markets close)
"""
import logging
from signal_detector import detect_rating_changes
from returns_calculator import calculate_pending_returns

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    logging.info("=" * 50)
    logging.info("Starting Daily Signal Processing")
    logging.info("=" * 50)
    
    # 1. Detect new signals
    logging.info("\n[1/2] Detecting new rating changes...")
    detect_rating_changes()
    
    # 2. Calculate returns
    logging.info("\n[2/2] Calculating pending returns (1/10/30 days)...")
    calculate_pending_returns()
    
    logging.info("\n✅ Daily job completed!")
