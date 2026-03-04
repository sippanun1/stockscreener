import { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  onSymbolUnavailable?: () => void;
}

function TradingViewWidget({ symbol, onSymbolUnavailable }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const intendedSymbolRef = useRef<string>('');
  const unavailableCalledRef = useRef(false);

  useEffect(() => {
    // Reset state when symbol changes
    unavailableCalledRef.current = false;

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
    let tickerOnly = symbol;

    if (symbol.includes(':') || symbol.includes('-')) {
      const parts = symbol.split(/[:-]/);
      const market = parts[0].toUpperCase();
      const ticker = parts[1].toUpperCase();
      const tvExchange = marketMap[market] || market;
      cleanSymbol = `${tvExchange}:${ticker}`;
      tickerOnly = ticker;
    } else {
      cleanSymbol = symbol.toUpperCase();
      tickerOnly = symbol.toUpperCase();
    }

    intendedSymbolRef.current = tickerOnly;

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

    // --- Detection: postMessage listener ---
    const handleMessage = (e: MessageEvent) => {
      if (unavailableCalledRef.current) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        // TradingView emits events with a name field when symbol changes
        if (data?.name === 'widgetReady' || data?.name === 'tv-widget-load') {
          // Widget ready — nothing to do, this is fine
          return;
        }
        // If TradingView fires a symbol_resolved or symbol_error that doesn't match our intended ticker
        if (data?.name === 'quoteUpdate' || data?.name === 'symbol_resolved') {
          const loadedSymbol: string = (data?.data?.symbol || data?.symbol || '').toUpperCase();
          if (loadedSymbol && !loadedSymbol.includes(intendedSymbolRef.current) && intendedSymbolRef.current) {
            unavailableCalledRef.current = true;
            onSymbolUnavailable?.();
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    window.addEventListener('message', handleMessage);

    // --- Detection: MutationObserver + Timeout fallback ---
    // If after 5s the iframe title shows a different symbol, we flag it
    const timeoutId = setTimeout(() => {
      if (unavailableCalledRef.current) return;
      const iframes = container.current?.querySelectorAll('iframe');
      if (iframes && iframes.length > 0) {
        for (const iframe of iframes) {
          try {
            // Try to read the title attribute from the iframe
            const title = iframe.getAttribute('title') || '';
            if (title && !title.toUpperCase().includes(intendedSymbolRef.current)) {
              unavailableCalledRef.current = true;
              onSymbolUnavailable?.();
              break;
            }
          } catch {
            // Cross-origin: cannot read iframe content
          }
        }
      }
    }, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
    };
  }, [symbol, onSymbolUnavailable]);

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
