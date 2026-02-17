
from database import get_client

def check_returns():
    client = get_client()
    try:
        # Check count
        res = client.table("signal_returns").select("id", count="exact").limit(1).execute()
        count = res.count
        print(f"Total signal_returns: {count}")
        
        if count > 0:
            # Check sample
            res = client.table("signal_returns").select("*").limit(5).execute()
            print("Sample data:", res.data)
            
            # Check distinct symbols with completed returns
            res = client.table("signal_returns").select("symbol").eq("status", "COMPLETED").limit(100).execute()
            print(f"Completed signals sample: {len(res.data)}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_returns()
