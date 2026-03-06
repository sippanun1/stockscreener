import { useEffect, useRef, memo, useState } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  onSymbolUnavailable?: () => void;
}

function TradingViewWidget({ symbol, onSymbolUnavailable }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    // Reset state on symbol change
    setIsConfirmed(false);

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

    const symbolParts = symbol.split(/[:-]/);
    const targetTicker = symbolParts.length > 1 ? symbolParts[1].toUpperCase() : symbol.toUpperCase();

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

    let localConfirmed = false;

    const handleMessage = (e: MessageEvent) => {
      if (localConfirmed) return;
      try {
        const raw = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!raw) return;

        const isQuoteUpdate = raw.name === 'quoteUpdate' || raw.name === 'quote_update';
        if (isQuoteUpdate) {
          const msgTicker = (raw?.data?.short_name || raw?.data?.s || "").toString().toUpperCase();
          const msgOriginalName = (raw?.data?.original_name || "").toString().toUpperCase();
          
          const isCorrectSymbol = 
            msgTicker.includes(targetTicker) || 
            msgOriginalName.includes(targetTicker) ||
            targetTicker.includes(msgTicker && msgTicker.length > 0 ? msgTicker : "INVALID_MATCH");

          if (isCorrectSymbol) {
            const price =
              raw?.data?.last_price ?? 
              raw?.data?.v?.lp ??      
              raw?.data?.v?.close ??
              raw?.data?.lp ??
              0;

            if (Number(price) > 0) {
              localConfirmed = true;
              setIsConfirmed(true);
              clearTimeout(timeoutId);
            }
          }
        }

        if (raw.name === 'symbolInfo' || raw.name === 'symbol_resolved') {
          // Extra safety: check if symbol resolved matches what we expect
          // But usually we'll wait for the price to be sure it's not restricted
        }
      } catch {
        // ignore parse errors
      }
    };

    window.addEventListener('message', handleMessage);

    const timeoutId = setTimeout(() => {
      if (!localConfirmed) {
        onSymbolUnavailable?.();
      }
    }, 7000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
    };
  }, [symbol, onSymbolUnavailable]);

  return (
    <div className="tradingview-widget-container relative" style={{ height: "100%", width: "100%" }}>
      {!isConfirmed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          <div className="relative w-12 h-12">
            {/* Background Track */}
            <div className="absolute inset-0 border-4 border-gray-100/20 rounded-full"></div>
            {/* Rotating Arc */}
            <div className="absolute inset-0 border-4 border-transparent border-t-gray-400 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-400 text-sm font-medium">Loading Chart...</p>
        </div>
      )}
      <div
        className="tradingview-widget-container__widget transition-opacity duration-300"
        style={{ 
          height: "calc(100% - 32px)", 
          width: "100%",
          opacity: isConfirmed ? 1 : 0 
        }}
        ref={container}
      />
    </div>
  );
}

export default memo(TradingViewWidget);
