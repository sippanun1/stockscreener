#!/usr/bin/env python3
"""
Daily job: Detect new signals + Calculate pending returns
Run at 6:00 AM daily (after all markets close)
"""
import logging
from datetime import date
from database import get_client
from returns_calculator import calculate_pending_returns

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def process_signals_batch(target_date: str = None):
    """
    [Bottleneck Fix #5] Call the SQL batch function process_signals_for_date() ONCE
    after all market data has been ingested. Much faster than the old row-level trigger
    which fired 2 heavy SQL ops per row during ingestion.
    """
    client = get_client()
    date_to_use = target_date or str(date.today())
    
    print(f">> 🔍 Running batch signal processing for date: {date_to_use}")
    try:
        result = client.rpc('process_signals_for_date', {'p_date': date_to_use}).execute()
        count = result.data if result.data else 0
        print(f">> ✅ Batch signal processing complete: {count} new signals recorded")
        return count
    except Exception as e:
        logging.error(f">> ❌ Error in batch signal processing: {e}")
        return 0

if __name__ == "__main__":
    logging.info("=" * 50)
    logging.info("Starting Daily Signal Processing")
    logging.info("=" * 50)
    
    # 1. Run batch signal processing (new entry + exit closing) via SQL function
    logging.info("\n[1/2] Running batch signal processing...")
    process_signals_batch()
    
    # 2. Calculate returns for older pending signals (1/10/30 days)
    logging.info("\n[2/2] Calculating pending returns (1/10/30 days)...")
    calculate_pending_returns()
    
    logging.info("\n✅ Daily job completed!")

