import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StockLogo } from "./StockLogo";
import { ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";

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

const getRatingTextColor = (rating: string | undefined) => {
  if (!rating) return "text-[#7588A3]";
  switch (rating) {
    case "Strong Buy":
    case "Buy":
      return "text-[#10B981]";
    case "Neutral":
      return "text-[#7588A3]";
    case "Sell":
    case "Strong Sell":
      return "text-[#EF4444]";
    default:
      return "text-[#7588A3]";
  }
};

const getResultColor = (result: number | undefined) => {
  if (result === undefined || result === null) return "text-[#7588A3]";
  if (result > 0) return "text-[#10B981]";
  if (result < 0) return "text-[#EF4444]";
  return "text-[#7588A3]";
};

const getSignalDot = (result: number | undefined) => {
  if (result === undefined || result === null) return "bg-[#7588A3]";
  return result >= 0 ? "bg-[#10B981]" : "bg-[#EF4444]";
};

const formatDateToDisplay = (dateStr: string) => {
  try {
    const date = parseISO(dateStr);
    return format(date, "MMM dd, yyyy");
  } catch {
    return dateStr;
  }
};

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StockDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStockDetail = async () => {
      if (!symbol) return;
      
      // Convert URL format (NASDAQ-AAPL) back to API format (NASDAQ:AAPL)
      const apiSymbol = symbol.replace('-', ':');
      
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:8000/api/stock/${encodeURIComponent(apiSymbol)}/detail`);
        
        if (!response.ok) {
          navigate('/404', { replace: true });
          return;
        }
        
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching stock detail:", error);
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
    return null;
  }

  return (
    <div className="px-[53px] py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#F8FAFC]">Stock Detail</h1>
        <button
          onClick={() => navigate("/")}
          className="text-[#7588A3] hover:text-[#F8FAFC] transition-colors text-sm"
        >
          BACK
        </button>
      </div>

      {/* Stock Info Header */}
      <div className="bg-[#131A26] rounded-xl p-6 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Star icon */}
            <span className="text-[#7588A3] text-xl cursor-pointer hover:text-yellow-400 transition-colors">☆</span>
            
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

      {/* Stats Cards - Figma Style: Horizontal Layout */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-[#131A26] rounded-xl p-6 border border-[#1E2530] flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[#F8FAFC] text-base">Total Signals</div>
            <div className="text-[#F8FAFC] text-sm opacity-50">All time</div>
          </div>
          <div className="text-[#F8FAFC] text-5xl font-bold">{data.stats.total_signals}</div>
        </div>

        <div className="bg-[#131A26] rounded-xl p-6 border border-[#1E2530] flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[#F8FAFC] text-base">Win Rate</div>
            <div className="text-[#F8FAFC] text-sm opacity-50">Historical accuracy</div>
          </div>
          <div className="text-[#F8FAFC] text-5xl font-bold">{data.stats.win_rate.toFixed(0)}%</div>
        </div>

        <div className="bg-[#131A26] rounded-xl p-6 border border-[#1E2530] flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[#F8FAFC] text-base">Average Return</div>
            <div className="text-[#F8FAFC] text-sm opacity-50">Per signal</div>
          </div>
          <div className="text-[#F8FAFC] text-5xl font-bold">
            {data.stats.avg_return >= 0 ? "+" : ""}{data.stats.avg_return.toFixed(1)}%
          </div>
        </div>

        <div className="bg-[#131A26] rounded-xl p-6 border border-[#1E2530] flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[#F8FAFC] text-base">Best Return</div>
            <div className="text-[#F8FAFC] text-sm opacity-50">Single trade</div>
          </div>
          <div className="text-[#F8FAFC] text-5xl font-bold">
            {data.stats.best_return >= 0 ? "+" : ""}{data.stats.best_return.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Rating History - Figma Style */}
      <div>
        <h2 className="text-[#F8FAFC] text-lg font-semibold mb-4">Rating History</h2>
        
        <div className="space-y-4">
          {data.history.length > 0 ? (
            data.history.map((item, index) => (
              <div
                key={index}
                className="flex items-stretch"
              >
                {/* Signal Dot - Outside the card */}
                <div className="flex items-center mr-3">
                  <div className={`w-3 h-3 rounded-full ${getSignalDot(item.result)}`}></div>
                </div>

                {/* Main Card */}
                <div className="flex-1 bg-[#131A26] rounded-xl border border-[#1E2530] flex items-stretch overflow-hidden min-h-[80px]">
                  {/* Left Section: Date, Rating Change */}
                  <div className="flex-1 flex flex-col justify-center p-5">
                    {/* Date */}
                    <div className="flex items-center gap-2 text-[#F8FAFC] text-sm mb-2">
                      <span>📅</span>
                      <span>{formatDateToDisplay(item.date)}</span>
                    </div>
                    
                    {/* Rating Change - Both as colored text */}
                    <div className="flex items-center gap-2">
                      <span className={`${getRatingTextColor(item.from_rating)} text-sm font-medium`}>
                        {item.from_rating}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#7588A3]" />
                      <span className={`${getRatingTextColor(item.to_rating)} text-sm font-medium`}>
                        {item.to_rating}
                      </span>
                    </div>
                  </div>

                  {/* Vertical Divider */}
                  <div className="w-px bg-[#1E2530]"></div>

                  {/* Entry Price */}
                  <div className="w-[140px] flex flex-col justify-center items-center py-2 px-4">
                    <div className="text-[#F8FAFC] text-sm font-semibold mb-2">Entry Price</div>
                    <div className="text-[#F8FAFC] text-base font-semibold">
                      ${item.entry_price.toFixed(2)}
                    </div>
                  </div>

                  {/* Vertical Divider */}
                  <div className="w-px bg-[#1E2530]"></div>

                  {/* Days Held */}
                  <div className="w-[140px] flex flex-col justify-center items-center py-2 px-4">
                    <div className="text-[#F8FAFC] text-sm font-semibold mb-2">Days Held</div>
                    <div className="text-[#F8FAFC] text-base font-semibold whitespace-nowrap">
                      {item.days_held !== undefined ? `${item.days_held} days` : "-"}
                    </div>
                  </div>

                  {/* Vertical Divider */}
                  <div className="w-px bg-[#1E2530]"></div>

                  {/* Result */}
                  <div className="w-[140px] flex flex-col justify-center items-center py-2 px-4">
                    <div className="text-[#F8FAFC] text-sm font-semibold mb-2">Result</div>
                    <div className={`text-base font-semibold ${getResultColor(item.result)}`}>
                      {item.result !== undefined
                        ? `${item.result >= 0 ? "+" : ""}${item.result.toFixed(1)}%`
                        : "-"}
                    </div>
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
