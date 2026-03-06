import { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  onSymbolUnavailable?: () => void; // kept for API compatibility, no longer used
}

function TradingViewWidget({ symbol }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current) {
      container.current.innerHTML = '';
    }

    const marketMap: Record<string, string> = {
      'TH': 'SET',
      'JP': 'TSE',
      'HK': 'HKEX',
      'US': 'NASDAQ',
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
      cleanSymbol = `${tvExchange}:${ticker}`;
    } else {
      cleanSymbol = symbol.toUpperCase();
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: cleanSymbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      backgroundColor: "rgba(0, 0, 0, 1)",
      gridColor: "rgba(30, 37, 48, 1)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      allow_symbol_change: false,
      container_id: "tradingview_widget",
      support_host: "https://www.tradingview.com"
    });

    if (container.current) {
      container.current.appendChild(script);
    }
  }, [symbol]);

  return (
    <div className="tradingview-widget-container" style={{ height: "100%", width: "100%" }}>
      <div
        className="tradingview-widget-container__widget"
        style={{ height: "calc(100% - 32px)", width: "100%" }}
        ref={container}
      />
    </div>
  );
}

export default memo(TradingViewWidget);
