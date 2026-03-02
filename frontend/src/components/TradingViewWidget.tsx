import { useEffect, useRef, memo } from 'react';

function TradingViewWidget({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clean up previous script if symbol changes
    if (container.current) {
        container.current.innerHTML = '';
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    
    // Map internal markets to TradingView recognized exchanges
    const marketMap: Record<string, string> = {
      'TH': 'SET',
      'JP': 'TSE',
      'HK': 'HKEX',
      'US': 'NASDAQ', // Or NYSE, but TradingView can usually auto-resolve US symbols without prefix
      'IN': 'NSE',
      'VN': 'HOSE',
      'UK': 'LSE'
    };

    let cleanSymbol = symbol;
    if (symbol.includes(':') || symbol.includes('-')) {
      const parts = symbol.split(/[:-]/);
      const market = parts[0].toUpperCase();
      const ticker = parts[1].toUpperCase();
      
      const tvExchange = marketMap[market] || market;
      // For US, TradingView often handles it better without a prefix if it's dual-listed or just use the ticker
      // But adding the explicit mapped exchange is safest.
      cleanSymbol = `${tvExchange}:${ticker}`;
    } else {
      cleanSymbol = symbol.toUpperCase();
    }

    script.innerHTML = `
      {
        "autosize": true,
        "symbol": "${cleanSymbol}",
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "backgroundColor": "rgba(0, 0, 0, 1)",
        "gridColor": "rgba(30, 37, 48, 1)",
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "allow_symbol_change": false,
        "container_id": "tradingview_widget",
        "support_host": "https://www.tradingview.com"
      }`;
      
    if (container.current) {
      container.current.appendChild(script);
    }

    return () => {
      // Intentionally do not clear innerHTML on unmount during development strict mode to avoid flashing issues.
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container" style={{ height: "100%", width: "100%" }}>
      <div className="tradingview-widget-container__widget" style={{ height: "calc(100% - 32px)", width: "100%" }} ref={container}></div>
    </div>
  );
}

export default memo(TradingViewWidget);
