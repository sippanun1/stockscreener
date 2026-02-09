from signal_detector import record_signal_entry
from database import get_client
import logging

logger = logging.getLogger(__name__)

def backfill_historical_signals(batch_size=1000):
    """Backfill ข้อมูล rating changes ย้อนหลัง (แบบ pagination)"""
    client = get_client()
    
    logger.info("🔄 Starting historical backfill...")
    
    processed = 0
    skipped = 0
    offset = 0
    
    while True:
        # Query แบบ pagination
        logger.info(f"Fetching batch: offset={offset}, limit={batch_size}")
        
        result = client.table("stock_ratings")\
            .select("symbol, market, rating_change_date, previous_rating, technical_rating, current_price")\
            .not_.is_("previous_rating", "null")\
            .neq("previous_rating", "technical_rating")\
            .order("rating_change_date", desc=True)\
            .range(offset, offset + batch_size - 1)\
            .execute()
        
        if not result.data:
            logger.info("No more data to process")
            break
        
        logger.info(f"Processing {len(result.data)} records...")
        
        for stock in result.data:
            success = record_signal_entry(
                symbol=stock['symbol'],
                market=stock['market'],
                signal_date=stock['rating_change_date'],
                from_rating=stock['previous_rating'],
                to_rating=stock['technical_rating'],
                signal_entry_price=stock['current_price']
            )
            
            if success:
                processed += 1
            else:
                skipped += 1
        
        offset += batch_size
        
        # ถ้าได้น้อยกว่า batch_size แสดงว่าหมดแล้ว
        if len(result.data) < batch_size:
            break
    
    logger.info(f"✅ Backfill complete: {processed} signals recorded, {skipped} skipped")
    return processed

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    backfill_historical_signals()
