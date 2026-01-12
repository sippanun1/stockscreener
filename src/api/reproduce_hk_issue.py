import requests
import json

url = "https://scanner.tradingview.com/hongkong/scan"
headers = {
    "accept": "application/json",
    "content-type": "text/plain;charset=UTF-8",
    "origin": "https://www.tradingview.com",
    "referer": "https://www.tradingview.com/",
    "user-agent": "Mozilla/5.0",
}
columns = ["name", "close", "Recommend.All", "description"]

payload = {
    "columns": columns,
    "range": [0, 5],
    "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"},
    "markets": ["stock"],
    "symbols": {
        "query": {"types": ["stock"]},
        "tickers": []
    },
    "filter": [
        {"left": "market_cap_basic", "operation": "nempty"}
    ]
}

r = requests.post(url, data=json.dumps(payload), headers=headers)
data = r.json().get("data", [])

print(f"Fetched {len(data)} rows")
for row in data:
    print(f"s: {row.get('s')}")
    print(f"d: {row.get('d')}")
