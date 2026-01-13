import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StockLogo } from "./StockLogo";
import { ArrowRight, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
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

const getResultColor = (result: number | undefined) => {
  if (result === undefined || result === null) return "text-[#7588A3]";
  if (result > 0) return "text-[#10B981]";
  if (result < 0) return "text-[#EF4444]";
  return "text-[#7588A3]";
};

const formatDateToDisplay = (dateStr: string) => {
  try {
    const date = parseISO(dateStr);
    return format(date, "MMM dd, yyyy").toUpperCase();
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

  return (
    <div className="px-[53px] py-6">
      {/* Back Button */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-[#7588A3] hover:text-[#F8FAFC] transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm">Back to Screener</span>
      </button>

      {/* Compact Header */}
      <div className="flex justify-between items-center mb-8 bg-[#131A26] rounded-2xl p-6 border border-[#1E2530] shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative">
            <StockLogo 
              symbol={data.symbol} 
              name={data.name} 
              className="w-14 h-14 text-xl shadow-lg" 
            />
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${isPositiveChange ? 'bg-[#10B981]' : 'bg-[#EF4444]'} flex items-center justify-center shadow-md`}>
              {isPositiveChange ? (
                <TrendingUp className="w-3 h-3 text-white" />
              ) : (
                <TrendingDown className="w-3 h-3 text-white" />
              )}
            </div>
          </div>
          <div>
            <div className="text-[#F8FAFC] font-bold text-3xl tracking-tight">
              {data.symbol.split(":")[1] || data.symbol}
            </div>
            <div className="text-[#7588A3] text-sm mt-0.5">{data.name}</div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[#F8FAFC] text-4xl font-bold tracking-tight">
            ${data.current_price.toFixed(2)}
          </div>
          <div className={`text-base font-medium flex items-center justify-end gap-2 mt-1 ${getResultColor(data.change_percent)}`}>
            {isPositiveChange ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>
              {data.change >= 0 ? "+" : ""}{data.change.toFixed(2)} ({data.change_percent >= 0 ? "+" : ""}{data.change_percent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Filter Signals + Win Rate */}
      <div className="grid grid-cols-[2fr_1fr] gap-6 mb-8">
        {/* Filter Signals */}
        <div className="bg-[#131A26] rounded-2xl p-6 border border-[#1E2530] hover:border-[#2D3748] transition-colors">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-[#F8FAFC] text-lg font-semibold">Filter Signals</h3>
            <button className="text-[#7588A3] text-sm hover:text-[#10B981] transition-colors flex items-center gap-1">
              View History
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            {filterButtons.map((filter) => {
              const isActive = selectedFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(isActive ? null : filter)}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? `${getRatingColor(filter)} border-transparent text-[#F8FAFC] shadow-lg scale-[1.02]`
                      : "bg-[#0F151F] border-[#2D3748] text-[#7588A3] hover:border-[#4A5568] hover:text-[#F8FAFC] hover:bg-[#1A2332]"
                  }`}
                >
                  {filter}
                </button>
              );
            })}
          </div>
          
          {selectedFilter && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-[#7588A3]">
                Showing <span className="text-[#F8FAFC] font-medium">{filteredHistory.length}</span> signals
              </span>
              <button 
                onClick={() => setSelectedFilter(null)}
                className="text-[#10B981] hover:underline"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>

        {/* Win Rate Card */}
        <div className="bg-gradient-to-br from-[#131A26] to-[#0F151F] rounded-2xl p-6 border border-[#1E2530] hover:border-[#2D3748] transition-colors relative overflow-hidden">
          {/* Subtle glow effect */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/5 rounded-full blur-3xl"></div>
          
          <div className="relative flex justify-between items-center">
            <div>
              <div className="text-[#F8FAFC] text-7xl font-bold tracking-tighter">
                {data.stats.win_rate.toFixed(0)}
                <span className="text-4xl text-[#7588A3] ml-1">%</span>
              </div>
              <div className="text-[#7588A3] text-sm mt-2">Accuracy</div>
            </div>

            {/* Vertical Divider */}
            <div className="h-16 w-px bg-[#2D3748] mx-8"></div>
            
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 text-[#F8FAFC] text-xl font-bold mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                Total: {data.stats.total_signals}
              </div>
              <div className="text-[#7588A3] text-sm">Historical accuracy</div>
            </div>
          </div>
      </div>
    </div>

      {/* Signal History */}
      <div className="space-y-4">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((item, index) => {
            const isProfit = item.result !== undefined && item.result >= 0;
            const status = item.result !== undefined ? (isProfit ? "COMPLETED" : "CLOSED") : "PENDING";
            
            return (
              <div 
                key={index} 
                className="flex items-center gap-6"
              >
                {/* Signal Dot - Ring Style */}
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                  isProfit ? "border-[#10B981]" : "border-[#EF4444]"
                } flex items-center justify-center`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isProfit ? "bg-[#10B981]" : "bg-[#EF4444]"
                  }`}></div>
                </div>

                {/* Main Card */}
                <div className="flex-1 bg-[#131A26] rounded-xl border border-[#1E2530] py-5 px-6">
                  {/* Grid Layout for Perfect Alignment */}
                  <div className="grid grid-cols-[350px_1fr_100px] items-center gap-4">
                    {/* Left: Date + Status + Rating Change */}
                    <div className="flex items-center gap-8">
                      <div>
                        <div className="text-[#7588A3] text-xs mb-1">{formatDateToDisplay(item.date)}</div>
                        <span className={`px-2.5 py-0.5 text-[10px] font-semibold rounded border ${
                          status === "COMPLETED" ? "border-[#7588A3] text-[#7588A3]" :
                          status === "CLOSED" ? "border-[#7588A3] text-[#7588A3]" :
                          "border-[#7588A3] text-[#7588A3]"
                        }`}>
                          {status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 ${getRatingColor(item.from_rating)} text-[#F8FAFC] rounded text-sm font-medium`}>
                          {item.from_rating}
                        </div>
                        <span className="text-[#7588A3]">→</span>
                        <div className={`px-3 py-1 ${getRatingColor(item.to_rating)} text-[#F8FAFC] rounded text-sm font-medium`}>
                          {item.to_rating}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Entry + Days + Exit - Using Fixed Width Inner Columns */}
                    <div className="flex justify-center">
                      <div className="flex items-center bg-[#0F151F] rounded-lg px-2 py-3">
                        <div className="w-[120px] text-center border-r border-[#2D3748]">
                          <div className="text-[#7588A3] text-[10px] mb-1 uppercase tracking-wider">Previous Price</div>
                          <div className="text-[#F8FAFC] text-lg font-semibold">${item.entry_price.toFixed(2)}</div>
                        </div>
                        
                        <div className="w-[140px] text-center border-r border-[#2D3748]">
                          <div className="text-[#7588A3] text-[10px] mb-1">
                            {item.days_held !== undefined ? `${item.days_held} days` : "—"}
                          </div>
                          <div className="text-[#7588A3] text-lg tracking-widest leading-none mt-1">• • •</div>
                        </div>

                        <div className="w-[120px] text-center">
                          <div className="text-[#7588A3] text-[10px] mb-1 uppercase tracking-wider">
                            {item.result !== undefined ? "Exit" : "Current"}
                          </div>
                          <div className="text-[#F8FAFC] text-lg font-semibold">${data.current_price.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Result */}
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getResultColor(item.result)}`}>
                        {item.result !== undefined
                          ? `${item.result >= 0 ? "+" : ""}${item.result.toFixed(1)}%`
                          : "—"}
                      </div>
                      {item.result !== undefined && (
                        <div className={`text-xs ${getResultColor(item.result)}`}>
                          {isProfit ? "Profit" : "Loss"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-[#131A26] rounded-xl p-12 text-center border border-[#1E2530]">
            <div className="text-[#7588A3] text-lg mb-2">No signals found</div>
            <div className="text-[#4A5568] text-sm">Try adjusting your filter selection</div>
          </div>
        )}
      </div>
    </div>
  );
}
