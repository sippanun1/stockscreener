from database import get_client
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def get_next_available_date(symbol: str, start_date: str, n: int = 1):
    """
    หาวันที่ n ที่มีข้อมูลจริงๆ หลังจาก start_date
    ใช้ข้อมูลจริงใน database - ไม่ต้องรู้วันหยุด!
    """
    client = get_client()
    
    result = client.table("stock_ratings")\
        .select("fetched_date")\
        .eq("symbol", symbol)\
        .gt("fetched_date", start_date)\
        .order("fetched_date", desc=False)\
        .limit(n)\
        .execute()
    
    if result.data and len(result.data) >= n:
        return result.data[n-1]['fetched_date']
    
    return None

def get_price_on_date(symbol: str, date: str):
    """ดึงราคาของหุ้นในวันที่กำหนด"""
    client = get_client()
    
    result = client.table("stock_ratings")\
        .select("current_price")\
        .eq("symbol", symbol)\
        .eq("fetched_date", date)\
        .order("fetched_time", desc=True)\
        .limit(1)\
        .execute()
    
    if result.data:
        return result.data[0].get('current_price')
    return None

def calculate_pending_returns():
    """คำนวณ returns สำหรับ signals ที่ยังไม่เสร็จ"""
    client = get_client()
    
    # หา signals ที่ยังคำนวณไม่เสร็จ
    pending = client.table("signal_returns")\
        .select("*")\
        .or_("return_1d.is.null,return_10d.is.null,return_30d.is.null")\
        .execute()
    
    logger.info(f"Found {len(pending.data)} pending signals")
    
    for signal in pending.data:
        symbol = signal['symbol']
        signal_date = signal['signal_date']
        entry_price = signal['signal_entry_price']
        
        # Calculate 1-day return
        if not signal['return_1d']:
            date_1d = get_next_available_date(symbol, signal_date, n=1)
            if date_1d:
                price = get_price_on_date(symbol, date_1d)
                if price and entry_price > 0:
                    return_pct = ((price - entry_price) / entry_price) * 100
                    update_return(signal['id'], '1d', price, return_pct, date_1d)
        
        # Calculate 10-day return
        if not signal['return_10d']:
            date_10d = get_next_available_date(symbol, signal_date, n=10)
            if date_10d:
                price = get_price_on_date(symbol, date_10d)
                if price and entry_price > 0:
                    return_pct = ((price - entry_price) / entry_price) * 100
                    update_return(signal['id'], '10d', price, return_pct, date_10d)
        
        # Calculate 30-day return
        if not signal['return_30d']:
            date_30d = get_next_available_date(symbol, signal_date, n=30)
            if date_30d:
                price = get_price_on_date(symbol, date_30d)
                if price and entry_price > 0:
                    return_pct = ((price - entry_price) / entry_price) * 100
                    update_return(signal['id'], '30d', price, return_pct, date_30d)

def update_return(signal_id: int, period: str, price: float, return_pct: float, calc_date: str):
    """Update return value ใน database"""
    client = get_client()
    
    update_data = {
        f"price_after_{period}": price,
        f"return_{period}": return_pct,
        f"return_{period}_calculated_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    client.table("signal_returns").update(update_data).eq("id", signal_id).execute()
    logger.info(f"✅ Updated {period} return for signal {signal_id}: {return_pct:.2f}%")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    calculate_pending_returns()
