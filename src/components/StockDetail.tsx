import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StockLogo } from "./StockLogo";
import { ArrowRight, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { getCurrencySymbol } from "./stock-table/columns";

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
  accuracy_stats: {
    [rating: string]: {
      wins: number;
      losses: number;
    };
  };
  history: RatingHistory[];
};


const getRatingStyles = (rating: string | undefined) => {
  if (!rating) return "text-[#7588A3]";
  
  switch (rating) {
    case "Strong Buy":
      return "bg-[#07FFB91A] text-[#00FFB7]";
    case "Buy":
      return "text-[#00FFB7]";
    case "Neutral":
      return "text-[#FFFFFF]";
    case "Sell":
      return "text-[#FF3069]";
    case "Strong Sell":
      return "bg-[#FF30691A] text-[#FF3069]";
    default:
      return "text-[#7588A3]";
  }
};

const getHeaderBadgeStyles = (rating: string | undefined) => {
  if (!rating) return "text-[#7588A3]";
  
  switch (rating) {
    case "Strong Buy":
      return "bg-[#07FFB91A] text-[#00FFB7]";
    case "Buy":
      return "bg-[#07FFB91A] text-[#00FFB7]";
    case "Neutral":
      return "bg-[#FFFFFF1A] text-[#FFFFFF]";
    case "Sell":
      return "bg-[#FF30691A] text-[#FF3069]";
    case "Strong Sell":
      return "bg-[#FF30691A] text-[#FF3069]";
    default:
      return "text-[#7588A3]";
  }
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
  const [selectedRating, setSelectedRating] = useState<string | null>(null);

  // Fetch stock detail with React Query (1 minute cache)
  const apiSymbol = symbol?.replace('-', ':') || '';
  
  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ['stockDetail', apiSymbol],
    queryFn: async () => {
      const response = await fetch(`http://localhost:8000/api/stock/${encodeURIComponent(apiSymbol)}/detail`);
      if (!response.ok) {
        throw new Error('Stock not found');
      }
      return response.json() as Promise<StockDetailData>;
    },
    enabled: !!symbol,
    staleTime: 1 * 60 * 1000, // 1 minute cache for detail pages
  });

  // Handle error by navigating to 404
  useEffect(() => {
    if (isError) {
      navigate('/404', { replace: true });
    }
  }, [isError, navigate]);

  if (loading) {
    return (
      <div className="p-8 mx-[53px] animate-pulse">
        {/* Back Button Skeleton */}
        <div className="h-6 w-32 bg-[#1E2530] rounded mb-8"></div>
        
        {/* Header Cards Row */}
        <div className="flex gap-6 mb-8">
          {/* Card 1 Skeleton */}
          <div className="bg-[#0F151F] rounded-2xl p-6 border border-[#1E2530] w-[350px]">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#1E2530]"></div>
              <div className="flex-1">
                <div className="h-6 w-24 bg-[#1E2530] rounded mb-2"></div>
                <div className="h-4 w-40 bg-[#1E2530] rounded"></div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-32 bg-[#1E2530] rounded"></div>
              <div className="h-6 w-20 bg-[#1E2530] rounded"></div>
            </div>
          </div>
          
          {/* Card 2 Skeleton */}
          <div className="bg-[#0F151F] rounded-2xl p-6 border border-[#1E2530] flex-1">
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <div className="h-8 w-24 bg-[#1E2530] rounded-full"></div>
                <div className="h-8 w-16 bg-[#1E2530] rounded-full"></div>
                <div className="h-8 w-16 bg-[#1E2530] rounded-full"></div>
                <div className="h-8 w-24 bg-[#1E2530] rounded-full"></div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="h-12 w-20 bg-[#1E2530] rounded mb-2"></div>
                  <div className="h-4 w-16 bg-[#1E2530] rounded"></div>
                </div>
                <div className="h-16 w-px bg-[#1E2530]"></div>
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-[#1E2530] rounded"></div>
                  <div className="h-4 w-24 bg-[#1E2530] rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Signal History Title */}
        <div className="h-7 w-40 bg-[#1E2530] rounded mb-6"></div>
        
        {/* Signal History Table Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-36 flex justify-center">
                <div className="w-5 h-5 rounded-full bg-[#1E2530]"></div>
              </div>
              <div className="flex-1 bg-[#0F151F] rounded-xl px-8 py-6 border border-[#1E2530]">
                <div className="grid grid-cols-5 items-center gap-4">
                  <div className="h-5 w-28 bg-[#1E2530] rounded"></div>
                  <div className="flex justify-center gap-3">
                    <div className="h-6 w-24 bg-[#1E2530] rounded-full"></div>
                    <div className="h-4 w-4 bg-[#1E2530] rounded"></div>
                    <div className="h-6 w-24 bg-[#1E2530] rounded-full"></div>
                  </div>
                  <div className="h-5 w-20 bg-[#1E2530] rounded ml-auto"></div>
                  <div className="h-4 w-4 bg-[#1E2530] rounded"></div>
                  <div className="h-8 w-24 bg-[#1E2530] rounded-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const filterButtons = ["Strong Sell", "Sell", "Buy", "Strong Buy"];
  const isPositiveChange = data.change_percent >= 0;

  // Get stats for selected rating or overall
  const getDisplayStats = () => {
    if (selectedRating) {
      // When a rating is selected, show only that rating's stats
      const stats = data.accuracy_stats[selectedRating];
      if (stats) {
        const total = stats.wins + stats.losses;
        const winRate = total > 0 ? (stats.wins / total) * 100 : 0;
        return {
          wins: stats.wins,
          losses: stats.losses,
          winRate: winRate
        };
      }
      // Rating selected but no signals exist for it - show 0
      return {
        wins: 0,
        losses: 0,
        winRate: 0
      };
    }
    // No filter selected - show overall stats
    const wins = data.history.filter(h => h.result !== undefined && h.result > 0).length;
    const losses = data.history.filter(h => h.result !== undefined && h.result < 0).length;
    return {
      wins,
      losses,
      winRate: data.stats.win_rate
    };
  };

  const displayStats = getDisplayStats();

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

      {/* Two Cards in Same Row */}
      <div className="flex gap-4 mb-8">
        {/* Card 1: Stock Information */}
        <div className="flex-shrink-0 bg-[#0F151F] rounded-2xl p-6 border border-[#1E2530] flex items-stretch justify-between shadow-sm">
          {/* Left Side: Logo + Basic Info */}
          <div className="flex items-center gap-4">
            <StockLogo 
              symbol={data.symbol} 
              name={data.name} 
              className="w-14 h-14 text-xl" 
            />
            
            <div className="flex flex-col h-full justify-between py-0.5">
                {/* Symbol + Name */}
                <div className="flex items-center gap-3">
                    <span className="text-[#F8FAFC] text-2xl font-bold">{data.symbol.split(":")[1] || data.symbol}</span>
                    <span className="text-[#7588A3] text-sm">{data.name}</span>
                </div>
                
                {/* Price + Change Value */}
                <div className="flex items-baseline gap-2">
                    <span className="text-[#F8FAFC] text-3xl font-bold">{data.current_price}</span>
                    <span className="text-[#7588A3] text-[0.65rem]">{getCurrencySymbol(data.market)}</span>
                    <span className={`text-lg font-medium ml-4 ${isPositiveChange ? 'text-[#00FFB7]' : 'text-[#FF3069]'}`}>
                        {data.change > 0 ? "+" : ""}{data.change}
                    </span>
                    <span className={`text-lg font-medium ml-3 ${isPositiveChange ? 'text-[#00FFB7]' : 'text-[#FF3069]'}`}>
                        ({data.change_percent > 0 ? "+" : ""}{data.change_percent.toFixed(2)}%)
                    </span>
                </div>
            </div>
          </div>

          {/* Right Side: Badge */}
          <div className="flex flex-col items-end justify-start py-0.5">
              <div className={`px-4 h-[28px] ${getHeaderBadgeStyles(data.current_rating)} rounded-[16px] flex items-center justify-center text-sm font-semibold whitespace-nowrap`}>
                  {data.current_rating}
              </div>
          </div>
        </div>

        {/* Card 2: Filters & Accuracy Stats */}
        <div className="bg-[#0F151F] rounded-2xl p-6 border border-[#1E2530] shadow-sm flex-1">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Rating Filter Buttons */}
            <div className="flex gap-3 flex-shrink-0">
                {filterButtons.map((filter) => {
                    const isActive = selectedRating === filter;
                    const isSellRating = filter === "Strong Sell" || filter === "Sell";
                    
                    // Determine colors based on rating type
                    const textColor = isSellRating ? "text-[#FF3069]" : "text-[#00FFB7]";
                    const activeBorderColor = isSellRating ? "border-[#FF3069]" : "border-[#00FFB7]";
                    
                    return (
                        <button
                        key={filter}
                        onClick={() => setSelectedRating(isActive ? null : filter)}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                            isActive
                            ? `bg-[#1E293B] ${activeBorderColor} ${textColor}`
                            : `border-[#2D3748] ${textColor} hover:bg-[#1E293B]/50`
                        }`}
                        >
                            {filter}
                        </button>
                    );
                })}
            </div>

            {/* Right: Accuracy Stats */}
            <div className="flex items-center gap-6 flex-shrink-0 mr-2">
                <div className="text-center">
                    <div className="text-[#00FFB7] text-5xl font-bold">{displayStats.winRate.toFixed(0)}%</div>
                    <div className="text-[#F8FAFC] text-sm font-medium mt-1">Accuracy</div>
                </div>
                
                {/* Vertical Divider */}
                <div className="h-16 w-px bg-[#1E2530]"></div>
                
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#00FFB7] shadow-[0_0_8px_rgba(0,255,183,0.6)]"></div>
                        <span className="text-[#F8FAFC] text-sm font-medium">Wins : {displayStats.wins}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#FF3069] shadow-[0_0_8px_rgba(255,48,105,0.6)]"></div>
                        <span className="text-[#F8FAFC] text-sm font-medium">Losses : {displayStats.losses}</span>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signal History Title */}
      <h2 className="text-[#F8FAFC] text-xl font-bold mb-6">Signal History</h2>

      {/* Signal History Table Container */}
      {/* Signal History Table Container */}
      <div>
        {/* Table Headers - Card Style */}
        <div className="flex items-center mb-4">
            <div className="w-36 flex-shrink-0"></div>
            <div className="flex-1 bg-[#0F151F] rounded-xl px-8 py-4 border border-[#1E2530] grid grid-cols-[1.2fr_1.5fr_1fr_1.2fr] text-[#F8FAFC] text-base font-semibold">
                <div>Date</div>
                <div className="text-center">Signal</div>
                <div>Previous Close</div>
                <div className="text-center">Result</div>
            </div>
        </div>

        {/* History Rows */}
        <div className="space-y-4">
          {data.history.length > 0 ? (
            data.history.map((item, index) => {
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
                    <div className="flex-1 bg-[#0F151F] rounded-xl px-8 py-6 border border-[#1E2530] grid grid-cols-[1.2fr_1.5fr_1fr_1.2fr] items-center hover:border-[#2D3748] transition-colors">
                          {/* Date */}
                          <div className="flex items-center gap-3 text-[#F8FAFC]">
                              <Calendar className="w-4 h-4 text-[#F8FAFC]" />
                              <span className="font-medium text-sm">{formatDateToDisplay(item.date)}</span>
                          </div>

                          {/* Signal Transition */}
                          <div className="flex items-center justify-center gap-3">
                              <div className={`w-[100px] h-[24px] ${getRatingStyles(item.from_rating)} rounded-[16px] flex items-center justify-center text-sm font-semibold`}>
                                  {item.from_rating}
                              </div>
                              <ArrowRight className="w-4 h-4 text-[#7588A3]" />
                              <div className={`w-[100px] h-[24px] ${getRatingStyles(item.to_rating)} rounded-[16px] flex items-center justify-center text-sm font-semibold`}>
                                  {item.to_rating}
                              </div>
                          </div>

                          {/* Previous Close - Left aligned */}
                          <div>
                              <span className="text-[#F8FAFC] font-bold">{item.entry_price}</span>
                              <span className="text-[#7588A3] text-[0.65rem] ml-1">{getCurrencySymbol(data.market)}</span>
                          </div>

                          {/* Result - Centered */}
                          <div className="text-center">
                              {item.exit_price && item.result !== undefined && item.result !== null ? (
                                  <div className="flex items-center justify-center gap-2">
                                      <span className="text-[#F8FAFC] font-bold">{item.exit_price}</span>
                                      <span className="text-[#7588A3] text-[0.65rem]">{getCurrencySymbol(data.market)}</span>
                                      <span className={`font-bold text-lg ${getResultColor(item.result)}`}>
                                          ({item.result > 0 ? "+" : ""}{item.result.toFixed(2)}%)
                                      </span>
                                  </div>
                              ) : (
                                  <div className="inline-flex">
                                      <div className="bg-[#1E40AF] text-white px-4 py-1.5 rounded-full text-sm font-semibold">
                                          Pending
                                      </div>
                                  </div>
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
