import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StockLogo } from "./StockLogo";
import { ArrowRight, ArrowLeft, Calendar, Star } from "lucide-react";
import { format, parseISO } from "date-fns";

type RatingHistory = {
  date: string;
  from_rating: string;
  to_rating: string;
  entry_price: number;
  exit_price?: number;
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

const getRatingTextColor = (rating: string | undefined) => {
  if (!rating) return "text-[#7588A3]";
  switch (rating) {
    case "Strong Buy":
    case "Buy":
      return "text-[#00FFB7]";
    case "Neutral":
      return "text-[#FFFFFF]";
    case "Sell":
    case "Strong Sell":
      return "text-[#FF3069]";
    default:
      return "text-[#7588A3]";
  }
};

const getRatingStyles = (rating: string | undefined) => {
  if (rating === "Strong Buy") {
    return "bg-[#07FFB91A] text-[#00FFB7]";
  }
  return getRatingTextColor(rating);
};

const getResultColor = (result: number | undefined) => {
  if (result === undefined || result === null) return "text-[#7588A3]";
  if (result > 0) return "text-[#00FFB7]";
  if (result < 0) return "text-[#FF3069]";
  return "text-[#7588A3]";
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
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchStockDetail = async () => {
      if (!symbol) return;
      
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[#7588A3] text-sm">Loading stock details...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const filterButtons = ["Strong Sell", "Sell", "Buy", "Strong Buy"];

  const filteredHistory = selectedFilter
    ? data.history.filter(item => item.to_rating === selectedFilter)
    : data.history;

  const isPositiveChange = data.change_percent >= 0;

  // Calculate wins/losses for the header
  const wins = data.history.filter(h => h.result !== undefined && h.result > 0).length;
  const losses = data.history.filter(h => h.result !== undefined && h.result < 0).length;

  return (
    <div className="px-[53px] py-6">
      <div className="flex justify-between items-center mb-6">
          <h1 className="text-[#F8FAFC] text-2xl font-bold">Stock Detail</h1>
          <button
            onClick={() => navigate("/")}
            className="text-[#00FFB7] hover:underline text-sm font-medium tracking-wider"
          >
            BACK
          </button>
      </div>

      {/* Main Header Card */}
      <div className="bg-[#0F151F] rounded-2xl p-8 border border-[#1E2530] mb-8 grid grid-cols-[1.5fr_1fr_1fr] items-center gap-8 shadow-sm">
        {/* Left: Logo & Info */}
        <div className="flex items-start gap-6">
            <button className="text-[#7588A3] hover:text-white transition-colors mt-2">
                <Star className="w-5 h-5" />
            </button>
            
            <StockLogo 
              symbol={data.symbol} 
              name={data.name} 
              className="w-16 h-16 text-2xl" 
            />
            
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-[#F8FAFC] text-3xl font-bold">{data.symbol.split(":")[1] || data.symbol}</span>
                    <span className="text-[#7588A3] text-sm">{data.name}</span>
                    <div className={`w-[91px] h-[20px] ${getRatingStyles(data.current_rating)} rounded-[16px] flex items-center justify-center text-xs font-semibold`}>
                        {data.current_rating}
                    </div>
                </div>
                
                {/* Filter Buttons */}
                <div className="flex gap-2">
                    {filterButtons.map((filter) => {
                        const isActive = selectedFilter === filter;
                        
                        // Determine color based on rating type
                        const getFilterColor = (rating: string) => {
                            if (rating === "Strong Sell" || rating === "Sell") {
                                return "text-[#FF3069] border-[#FF3069]";
                            }
                            return "text-[#00FFB7] border-[#00FFB7]";
                        };
                        
                        return (
                            <button
                            key={filter}
                            onClick={() => setSelectedFilter(isActive ? null : filter)}
                            className={`px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${
                                isActive
                                ? "bg-[#1E293B] border-[#00FFB7] text-[#00FFB7]" // Selected style
                                : `bg-transparent ${getFilterColor(filter)} hover:bg-[#1E293B]/50`
                            }`}
                            >
                            {filter}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Middle: Price */}
        <div className="flex flex-col items-center justify-center border-l border-r border-[#1E2530] h-full py-2">
             <div className="flex items-baseline gap-1">
                 <span className="text-[#F8FAFC] text-5xl font-bold tracking-tight">{data.current_price.toFixed(2)}</span>
                 <span className="text-[#7588A3] text-lg font-medium">USD</span>
             </div>
             <span className={`text-lg font-medium mt-1 ${isPositiveChange ? 'text-[#00FFB7]' : 'text-[#FF3069]'}`}>
                {data.change > 0 ? "+" : ""}{data.change.toFixed(2)} ({data.change_percent > 0 ? "+" : ""}{data.change_percent.toFixed(2)}%)
             </span>
        </div>

        {/* Right: Accuracy Stats */}
        <div className="flex items-center justify-center gap-10">
            <div className="text-center">
                <div className="text-[#00FFB7] text-6xl font-bold">{data.stats.win_rate.toFixed(0)}%</div>
                <div className="text-[#F8FAFC] text-sm font-medium mt-1">Accuracy</div>
            </div>
            
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#00FFB7] shadow-[0_0_8px_rgba(0,255,183,0.6)]"></div>
                    <span className="text-[#F8FAFC] text-sm font-medium">Wins : {wins}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF3069] shadow-[0_0_8px_rgba(255,48,105,0.6)]"></div>
                    <span className="text-[#F8FAFC] text-sm font-medium">Losses : {losses}</span>
                </div>
            </div>
        </div>
      </div>

      {/* Signal History Title */}
      <h2 className="text-[#F8FAFC] text-xl font-bold mb-6">Signal History</h2>

      {/* Signal History Table Container */}
      {/* Signal History Table Container */}
      <div>
        {/* Table Headers */}
        <div className="flex items-center mb-2">
            <div className="w-36 flex-shrink-0"></div>
            <div className="flex-1 grid grid-cols-[1.2fr_1.5fr_1fr_0.2fr_1fr_0.8fr] px-8 py-3 text-[#F8FAFC] text-sm font-medium">
                <div>Date</div>
                <div>Signal</div>
                <div className="text-center">Previous Price</div>
                <div></div> {/* Arrow Column Header */}
                <div className="text-center">Exit Price</div>
                <div className="text-right pr-4">Result</div>
            </div>
        </div>

        {/* History Rows */}
        <div className="space-y-4">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((item, index) => {
              const isProfit = item.result !== undefined && item.result > 0;
              const isLoss = item.result !== undefined && item.result < 0;
              // Determine dot color: Green for profit, Red for loss, Grey for Neutral/Pending
              const dotColor = isProfit ? "bg-[#00FFB7]" : isLoss ? "bg-[#FF3069]" : "bg-[#7588A3]";
              // Add shadow to dot
              const dotShadow = isProfit ? "shadow-[0_0_8px_rgba(0,255,183,0.6)]" : isLoss ? "shadow-[0_0_8px_rgba(255,48,105,0.6)]" : "";

              return (
                <div key={index} className="flex items-center group">
                    {/* Centered Dot Column */}
                    <div className="w-36 flex-shrink-0 flex justify-center">
                        <div className={`w-5 h-5 rounded-full ${dotColor} ${dotShadow}`}></div>
                    </div>

                    {/* Card */}
                    <div className="flex-1 bg-[#0F151F] rounded-xl px-8 py-6 border border-[#1E2530] grid grid-cols-[1.2fr_1.5fr_1fr_0.2fr_1fr_0.8fr] items-center hover:border-[#2D3748] transition-colors">
                          {/* Date */}
                          <div className="flex items-center gap-3 text-[#F8FAFC]">
                              <Calendar className="w-4 h-4 text-[#F8FAFC]" />
                              <span className="font-medium text-sm">{formatDateToDisplay(item.date)}</span>
                          </div>

                          {/* Signal Transition */}
                          <div className="flex items-center gap-3">
                              <div className={`w-[91px] h-[20px] ${getRatingStyles(item.from_rating)} rounded-[16px] flex items-center justify-center text-xs font-semibold`}>
                                  {item.from_rating}
                              </div>
                              <ArrowRight className="w-4 h-4 text-[#7588A3]" />
                              <div className={`w-[91px] h-[20px] ${getRatingStyles(item.to_rating)} rounded-[16px] flex items-center justify-center text-xs font-semibold`}>
                                  {item.to_rating}
                              </div>
                          </div>

                          {/* Previous Price */}
                          <div className="text-center">
                              <span className="text-[#F8FAFC] font-bold">{item.entry_price.toFixed(2)}</span>
                              <span className="text-[#7588A3] text-xs font-medium ml-1">USD</span>
                          </div>

                          {/* Arrow Column */}
                          <div className="flex justify-center">
                              {item.exit_price && <ArrowRight className="w-3 h-3 text-[#7588A3]" />}
                          </div>

                          {/* Exit Price */}
                          <div className="text-center">
                              {item.exit_price ? (
                                  <>
                                      <span className="text-[#F8FAFC] font-bold">{item.exit_price.toFixed(2)}</span>
                                      <span className="text-[#7588A3] text-xs font-medium ml-1">USD</span>
                                  </>
                              ) : (
                                  <span className="text-[#F8FAFC] text-xl tracking-widest leading-none pb-1">•••</span>
                              )}
                          </div>

                          {/* Result */}
                          <div className={`text-right pr-4 font-bold text-lg ${getResultColor(item.result)}`}>
                              {item.result !== undefined ? (
                                  <>{item.result > 0 ? "+" : ""}{item.result.toFixed(2)}%</>
                              ) : (
                                  "—"
                              )}
                          </div>
                    </div>
                </div> 
              );
            })
          ) : (
            <div className="bg-[#0F151F] rounded-xl p-12 text-center border border-[#1E2530]">
              <div className="text-[#7588A3] text-lg mb-2">No signals found</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
