from database import get_client
import logging

logger = logging.getLogger(__name__)

def record_signal_entry(symbol: str, market: str, signal_date: str, 
                        from_rating: str, to_rating: str, signal_entry_price: float):
    """บันทึก signal entry เมื่อ rating เปลี่ยน"""
    client = get_client()
    
    record = {
        "symbol": symbol,
        "market": market,
        "signal_date": signal_date,
        "from_rating": from_rating,
        "to_rating": to_rating,
        "signal_entry_price": signal_entry_price
    }
    
    try:
        result = client.table("signal_returns").upsert(record).execute()
        logger.info(f">> ✅ Signal recorded: {symbol} {from_rating}→{to_rating} @ {signal_entry_price}")
        return result
    except Exception as e:
        logger.error(f">> ❌ Error recording signal {symbol}: {e}")
        return None

def detect_rating_changes():
    """หา rating changes จาก stock_ratings และบันทึก"""
    client = get_client()
    
    print(">> 🔍 Querying stocks with rating changes...")
    
    # Query stocks ที่มี rating change
    response = client.rpc('get_stocks_with_last_rating', {
        'limit_val': 50000
    }).execute()
    
    total_checked = len(response.data) if response.data else 0
    print(f">> 📊 Total stocks checked: {total_checked}")
    
    count = 0
    for stock in response.data:
        # เช็คว่า rating เปลี่ยนหรือไม่
        if stock.get('previous_rating') and stock['previous_rating'] != stock['technical_rating']:
            result = record_signal_entry(
                symbol=stock['symbol'],
                market=stock['market'],
                signal_date=stock['rating_change_date'],
                from_rating=stock['previous_rating'],
                to_rating=stock['technical_rating'],
                signal_entry_price=stock['current_price']
            )
            if result:
                count += 1
    
    print(f">> ✅ Detected and recorded {count} rating changes")
    logger.info(f">> ✅ Detected {count} rating changes")
    return count

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    detect_rating_changes()

