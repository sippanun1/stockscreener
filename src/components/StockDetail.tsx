import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StockLogo } from "./StockLogo";
import { ArrowRight } from "lucide-react";

type RatingHistory = {
  date: string;
  from_rating: string;
  to_rating: string;
  entry_price: number;
  days_held?: number;
  result?: number;
};

type StockDetailData = {
  symbol: string;
  name: string;
  market: string;
  current_price: number;
  current_rating: string;
  change: number;
  change_percent: number;
  stats: {
    total_signals: number;
    win_rate: number;
    avg_return: number;
    best_return: number;
  };
  history: RatingHistory[];
};

const getRatingColor = (rating: string | undefined) => {
  if (!rating) return "bg-[#354052]";
  switch (rating) {
    case "Strong Buy":
      return "bg-[#065F46]";
    case "Buy":
      return "bg-[#007957]";
    case "Neutral":
      return "bg-[#6B7280]";
    case "Sell":
      return "bg-[#CE0F44]";
    case "Strong Sell":
      return "bg-[#A10F38]";
    default:
      return "bg-[#6B7280]";
  }
};

const getResultColor = (result: number | undefined) => {
  if (!result) return "text-[#7588A3]";
  if (result > 0) return "text-[#10B981]";
  if (result < 0) return "text-[#EF4444]";
  return "text-[#7588A3]";
};

const getSignalDot = (result: number | undefined) => {
  if (!result) return "bg-[#7588A3]";
  return result >= 0 ? "bg-[#10B981]" : "bg-[#EF4444]";
};

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StockDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStockDetail = async () => {
      if (!symbol) return;
      
      // Convert URL format (NASDAQ-AAPL) back to API format (NASDAQ:AAPL)
      const apiSymbol = symbol.replace('-', ':');
      
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`http://localhost:8000/api/stock/${encodeURIComponent(apiSymbol)}/detail`);
        
        if (!response.ok) {
          // Navigate to 404 page for any error
          navigate('/404', { replace: true });
          return;
        }
        
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching stock detail:", error);
        // Navigate to 404 page on network error
        navigate('/404', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchStockDetail();
  }, [symbol, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#7588A3] text-lg">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return null; // Will redirect to 404
  }

  return (
    <div className="px-[53px] py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#F8FAFC]">Stock Detail</h1>
        <button
          onClick={() => navigate("/")}
          className="text-[#7588A3] hover:text-[#F8FAFC] transition-colors"
        >
          BACK
        </button>
      </div>

      {/* Stock Info Header */}
      <div className="bg-[#131A26] rounded-xl p-6 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Star icon placeholder */}
            <span className="text-[#7588A3] text-xl">☆</span>
            
            {/* Logo + Symbol */}
            <div className="flex items-center gap-3">
              <StockLogo 
                symbol={data.symbol} 
                name={data.name} 
                className="w-12 h-12 text-xl" 
              />
              <span className="text-[#F8FAFC] font-bold text-xl">
                {data.symbol.split(":")[1] || data.symbol}
              </span>
            </div>

            {/* Rating Badge */}
            <div
              className={`px-3 py-1 ${getRatingColor(data.current_rating)} text-[#F8FAFC] rounded-full text-sm font-semibold`}
            >
              {data.current_rating}
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="text-[#F8FAFC] text-3xl font-bold">
              ${data.current_price.toFixed(2)}
            </div>
            <div className={getResultColor(data.change_percent)}>
              {data.change >= 0 ? "+" : ""}{data.change.toFixed(2)} ({data.change_percent >= 0 ? "+" : ""}{data.change_percent.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#131A26] rounded-xl p-4 border border-[#1E2530]">
          <div className="text-[#7588A3] text-sm mb-1">Total Signals</div>
          <div className="text-[#F8FAFC] text-xs text-opacity-60 mb-2">All time</div>
          <div className="text-[#F8FAFC] text-3xl font-bold">{data.stats.total_signals}</div>
        </div>

        <div className="bg-[#131A26] rounded-xl p-4 border border-[#1E2530]">
          <div className="text-[#7588A3] text-sm mb-1">Win Rate</div>
          <div className="text-[#F8FAFC] text-xs text-opacity-60 mb-2">Historical accuracy</div>
          <div className="text-[#F8FAFC] text-3xl font-bold">{data.stats.win_rate.toFixed(0)}%</div>
        </div>

        <div className="bg-[#131A26] rounded-xl p-4 border border-[#1E2530]">
          <div className="text-[#7588A3] text-sm mb-1">Average Return</div>
          <div className="text-[#F8FAFC] text-xs text-opacity-60 mb-2">Per signal</div>
          <div className={`text-3xl font-bold ${getResultColor(data.stats.avg_return)}`}>
            {data.stats.avg_return >= 0 ? "+" : ""}{data.stats.avg_return.toFixed(1)}%
          </div>
        </div>

        <div className="bg-[#131A26] rounded-xl p-4 border border-[#1E2530]">
          <div className="text-[#7588A3] text-sm mb-1">Best Return</div>
          <div className="text-[#F8FAFC] text-xs text-opacity-60 mb-2">Single trade</div>
          <div className={`text-3xl font-bold ${getResultColor(data.stats.best_return)}`}>
            {data.stats.best_return >= 0 ? "+" : ""}{data.stats.best_return.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Rating History */}
      <div>
        <h2 className="text-[#F8FAFC] text-lg font-semibold mb-4">Rating History</h2>
        
        <div className="space-y-3">
          {/* History Cards */}
          {data.history.length > 0 ? (
            data.history.map((item, index) => (
              <div
                key={index}
                className="bg-[#131A26] rounded-xl border border-[#1E2530] flex items-stretch overflow-hidden min-h-[80px]"
              >
                {/* Left Section: Dot, Date, Rating Change */}
                <div className="flex-1 flex items-center p-5">
                  {/* Signal Dot */}
                  <div className={`w-3 h-3 rounded-full ${getSignalDot(item.result)} mr-4 flex-shrink-0`}></div>
                  
                  {/* Content */}
                  <div>
                    {/* Date */}
                    <div className="flex items-center gap-2 text-[#7588A3] text-sm mb-2">
                      <span>📅</span>
                      <span>{item.date}</span>
                    </div>
                    
                    {/* Rating Change Badges */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 ${getRatingColor(item.from_rating)} text-[#F8FAFC] rounded text-xs font-medium`}
                      >
                        {item.from_rating}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#7588A3]" />
                      <span
                        className={`px-3 py-1 ${getRatingColor(item.to_rating)} text-[#F8FAFC] rounded text-xs font-medium`}
                      >
                        {item.to_rating}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="w-px bg-[#1E2530]"></div>

                {/* Entry Price */}
                <div className="w-[140px] flex flex-col justify-center items-center py-2 px-4">
                  <div className="text-[#7588A3] text-xs mb-1">Entry Price</div>
                  <div className="text-[#F8FAFC] font-semibold">
                    ${item.entry_price.toFixed(2)}
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="w-px bg-[#1E2530]"></div>

                {/* Days Held */}
                <div className="w-[140px] flex flex-col justify-center items-center py-2 px-4">
                  <div className="text-[#7588A3] text-xs mb-1">Days Held</div>
                  <div className="text-[#F8FAFC] whitespace-nowrap">
                    {item.days_held !== undefined ? `${item.days_held} days` : "-"}
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="w-px bg-[#1E2530]"></div>

                {/* Result */}
                <div className="w-[140px] flex flex-col justify-center items-center py-2 px-4">
                  <div className="text-[#7588A3] text-xs mb-1">Result</div>
                  <div className={`font-semibold ${getResultColor(item.result)}`}>
                    {item.result !== undefined
                      ? `${item.result >= 0 ? "+" : ""}${item.result.toFixed(1)}%`
                      : "-"}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-[#131A26] rounded-xl p-8 text-[#7588A3] text-center border border-[#1E2530]">
              No rating history available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
