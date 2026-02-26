import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StockLogo } from "./StockLogo";
import { ArrowRight, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { format, parseISO } from "date-fns";


type RatingHistory = {
  date: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  from_rating: string;
  to_rating: string;
  entry_price: number;
  exit_price?: number;
  days_held?: number;
  result?: number;
  status?: string;
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
  pre_market_history?: {
    fetched_date: string;
    current_price: number;
    technical_rating: string;
  }[];
  intraday_moves?: RatingHistory[];
};








const formatDateToDisplay = (dateStr: string) => {
  try {
    const date = parseISO(dateStr);
    return format(date, "MMM dd");
  } catch {
    return dateStr;
  }
};

const formatDateRange = (start: string | undefined, end: string) => {
  if (!start) return formatDateToDisplay(end);
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    return `${format(s, "MMM dd")} - ${format(e, "MMM dd")}`;
  } catch {
    return `${start} - ${end}`;
  }
};

// Get currency unit based on market
const getCurrencyUnit = (market: string): string => {
  const currencyMap: { [key: string]: string } = {
    'US': 'USD',
    'TH': 'THB',
    'HK': 'HKD',
    'JP': 'JPY',
    'IN': 'INR',
    'VN': 'VND',
    'UK': 'GBX',
  };
  return currencyMap[market] || 'USD';
};

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"daily" | "intraday">("daily");

  // API base URL from environment variable
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  if (!import.meta.env.VITE_API_URL) {
    console.error('[StockDetail] VITE_API_URL is not set! Falling back to localhost:8000. This will fail in production.');
  }

  // Fetch stock detail with React Query (1 minute cache)
  const apiSymbol = symbol?.replace('-', ':') || '';
  
  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ['stockDetail', apiSymbol],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/stock/${encodeURIComponent(apiSymbol)}/detail`);
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
      <div className="p-4 sm:p-6 lg:p-8 px-4 sm:px-6 lg:px-[53px] animate-pulse">
        {/* Back Button Skeleton */}
        <div className="h-6 w-32 bg-[#1E2530] rounded mb-6 sm:mb-8"></div>
        
        {/* Header Cards Row */}
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Card 1 Skeleton */}
          <div className="bg-[#0F151F] rounded-2xl p-4 sm:p-6 border border-[#1E2530] w-full lg:w-[350px]">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#1E2530]"></div>
              <div className="flex-1">
                <div className="h-5 sm:h-6 w-20 sm:w-24 bg-[#1E2530] rounded mb-2"></div>
                <div className="h-4 w-32 sm:w-40 bg-[#1E2530] rounded"></div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-6 sm:h-8 w-24 sm:w-32 bg-[#1E2530] rounded"></div>
              <div className="h-5 sm:h-6 w-16 sm:w-20 bg-[#1E2530] rounded"></div>
            </div>
          </div>
          
          {/* Card 2 Skeleton */}
          <div className="bg-[#0F151F] rounded-2xl p-4 sm:p-6 border border-[#1E2530] flex-1">
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
              <div className="h-8 w-20 sm:w-24 bg-[#1E2530] rounded-full"></div>
              <div className="h-8 w-14 sm:w-16 bg-[#1E2530] rounded-full"></div>
              <div className="h-8 w-14 sm:w-16 bg-[#1E2530] rounded-full"></div>
              <div className="h-8 w-20 sm:w-24 bg-[#1E2530] rounded-full"></div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-center">
                <div className="h-10 sm:h-12 w-16 sm:w-20 bg-[#1E2530] rounded mb-2"></div>
                <div className="h-4 w-14 sm:w-16 bg-[#1E2530] rounded"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Signal History Title */}
        <div className="h-6 sm:h-7 w-32 sm:w-40 bg-[#1E2530] rounded mb-4 sm:mb-6"></div>
        
        {/* Signal History Table Skeleton */}
        <div className="space-y-3 sm:space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 sm:gap-4">
              <div className="w-12 sm:w-24 lg:w-36 flex justify-center flex-shrink-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#1E2530]"></div>
              </div>
              <div className="flex-1 bg-[#0F151F] rounded-xl px-4 sm:px-8 py-4 sm:py-6 border border-[#1E2530]">
                <div className="h-5 w-full bg-[#1E2530] rounded"></div>
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

  // Filter history based on active tab AND selected rating
  const historyItemsAll = activeTab === "daily" 
    ? data.history 
    : (data.intraday_moves || []);

  const historyItems = selectedRating 
    ? historyItemsAll.filter(item => item.to_rating === selectedRating)
    : historyItemsAll;

  // Limit to latest 10 items
  const historyItemsDisplayed = historyItems.slice(0, 10);

  const hasHistory = historyItemsDisplayed.length > 0;

  // Calculate stats dynamically based on the CURRENT view (historyItems)
  // This ensures Intraday tab shows Intraday stats, and Daily shows Daily stats.
  const currentStats = (() => {
      // Use the filtered list for stats as well
      const itemsToCalc = historyItems; 

      const completed = itemsToCalc.filter(item => item.status === "COMPLETED" && item.result !== undefined);
      const total = completed.length;

      if (total === 0) {
          return { wins: 0, losses: 0, winRate: 0, avgReturn: 0 };
      }

      // Use same threshold as server: > 0.2 is Win, < -0.2 is Loss (or just > 0 for simpler UI matching?)
      // Server uses > 0.2. Let's stick to that for Consistency with "Accuracy".
      const wins = completed.filter(item => (item.result || 0) > 0.2).length;
      const losses = completed.filter(item => (item.result || 0) < -0.2).length;
      
      const winRate = (wins / total) * 100;
      const totalReturnSum = completed.reduce((sum, item) => sum + (item.result || 0), 0);
      const avgReturn = totalReturnSum / total;

      return { wins, losses, winRate, avgReturn };
  })();

  return (
     <div className="min-h-screen bg-[#000000] p-4 sm:p-6 lg:px-[40px] lg:py-[32px] font-sans">
       {/* Back Button */}
       <button 
         onClick={() => navigate('/')}
         className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors mb-6 group"
       >
         <div className="p-2 rounded-full bg-[#1E2530] group-hover:bg-[#2D3748] transition-colors">
            <ArrowLeft className="w-5 h-5" />
         </div>
         <span className="text-sm font-medium">Back to Screener</span>
       </button>

       {/* HEADER SECTION */}
       <div className="bg-[#0F151F] rounded-2xl p-6 border border-[#1E2530] flex flex-col sm:flex-row items-center justify-between mb-6 shadow-sm">
         {/* Left: Logo & Title */}
         <div className="flex items-center gap-5 w-full sm:w-auto">
           <StockLogo 
             symbol={data.symbol} 
             name={data.name} 
             className="w-16 h-16 sm:w-[72px] sm:h-[72px] text-2xl" 
           />
           <div>
             <h1 className="text-white text-3xl sm:text-[40px] font-bold tracking-tight leading-none mb-1">
               {data.symbol.split(":")[1] || data.symbol}
             </h1>
             <p className="text-[#94A3B8] text-lg font-medium tracking-wide">{data.name}</p>
           </div>
         </div>
 
         {/* Right: Price & Info */}
         <div className="text-left sm:text-right mt-6 sm:mt-0 w-full sm:w-auto flex flex-row sm:flex-col justify-between items-end">
           <div className="flex flex-col items-start sm:items-end w-full">
              <div className="text-white text-3xl sm:text-[32px] font-medium tracking-tight mb-3 flex items-baseline gap-2">
                 {data.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg text-[#94A3B8] font-normal">{getCurrencyUnit(data.market)}</span>
              </div>
              
              <div className="flex items-center gap-3">
                 <div className={`text-base font-medium flex items-center gap-2 ${isPositiveChange ? 'text-[#00FFB7]' : 'text-[#FF3069]'}`}>
                    <span>{data.change > 0 ? "+" : ""}{Number(data.change).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span>({data.change_percent > 0 ? "+" : ""}{data.change_percent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</span>
                 </div>
                  
                  <div className={`px-3 py-1 rounded-[4px] text-[11px] font-bold uppercase tracking-wider ${
                     data.current_rating === 'Strong Buy' ? 'bg-[#00FFB7]/20 text-[#00FFB7]' :
                     data.current_rating === 'Buy' ? 'bg-[#00FFB7]/20 text-[#00FFB7]' :
                     data.current_rating === 'Sell' ? 'bg-[#FF3069]/20 text-[#FF3069]' :
                     data.current_rating === 'Strong Sell' ? 'bg-[#FF3069]/20 text-[#FF3069]' :
                     'bg-[#7588A3]/20 text-[#7588A3]'
                  }`}>
                    {data.current_rating}
                  </div>
               </div>
           </div>
         </div>
       </div>
 
       {/* CONTROLS ROW: Toggles & Filters */}
       <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
         
         {/* Left: Timeframe Toggle */}
         <div className="bg-[#1E2530] rounded-lg p-1 flex items-center w-full sm:w-auto">
              <button 
                 onClick={() => setActiveTab('daily')}
                 className={`flex-1 sm:flex-none px-6 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                   activeTab === 'daily' 
                   ? 'bg-[#2D3748] text-[#E2E8F0] shadow-sm' 
                   : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                 }`}
              >
                Daily
              </button>
              <button 
                 onClick={() => setActiveTab('intraday')}
                 className={`flex-1 sm:flex-none px-6 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                   activeTab === 'intraday' 
                   ? 'bg-[#2D3748] text-[#E2E8F0] shadow-sm' 
                   : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                 }`}
              >
                Intraday
              </button>
         </div>
 
         {/* Right: Filters */}
        <div className="flex items-center justify-start sm:justify-end gap-2 sm:gap-3 bg-transparent w-full sm:w-auto pb-1 overflow-x-auto scrollbar-hide">
            <button 
            onClick={() => setSelectedRating(null)}
            className={`px-4 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wide border transition-all whitespace-nowrap flex-shrink-0 ${
                !selectedRating ? 'bg-[#2D3748] border-[#2D3748] text-white' : 'border-[#2D3748] text-[#94A3B8] hover:text-white'
            }`}
            >
            All
            </button>
            {filterButtons.map(filter => {
                const isSelected = selectedRating === filter;
                const isSell = filter.includes("Sell");
                const colorClass = isSell ? "text-[#FF3069]" : "text-[#00FFB7]";
                
                return (
                <button
                    key={filter}
                    onClick={() => setSelectedRating(isSelected ? null : filter)}
                    className={`px-4 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wide border transition-all duration-200 whitespace-nowrap shadow-sm flex-shrink-0 ${
                    isSelected 
                        ? isSell 
                            ? "bg-[#FF3069] border-[#FF3069] text-white" 
                            : "bg-[#10B981] border-[#10B981] text-white"
                        : `border-[#2D3748] ${colorClass} bg-transparent hover:bg-[#1E293B]`
                    }`}
                >
                    {filter}
                </button>
                )
            })}
        </div>
       </div>
 
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
           {/* Accuracy */}
           <div className="bg-[#0F151F] rounded-2xl p-6 border border-[#1E2530] flex flex-col justify-center items-center shadow-lg group hover:border-[#2D3748] transition-colors">
               <div className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider mb-2">Accuracy</div>
               {/* Issue 9 Fix: Show '-' when no completed trades exist, not '0%' */}
               {currentStats.wins + currentStats.losses === 0 ? (
                 <div className="text-[#7588A3] text-3xl sm:text-5xl font-bold tracking-tight">-</div>
               ) : (
                 <div className="text-[#00FFB7] text-3xl sm:text-5xl font-bold tracking-tight">{currentStats.winRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%</div>
               )}
           </div>
           
           {/* Total Return */}
           <div className="bg-[#0F151F] rounded-2xl p-6 border border-[#1E2530] flex flex-col justify-center items-center shadow-lg group hover:border-[#2D3748] transition-colors">
               <div className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider mb-2">Total</div>
               <div className={`text-3xl sm:text-5xl font-bold tracking-tight ${currentStats.avgReturn >= 0 ? "text-[#00FFB7]" : "text-[#FF3069]"}`}>
                 {currentStats.avgReturn > 0 ? "+" : ""}{currentStats.avgReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
               </div>
           </div>
 
             {/* Wins */}
             <div className="bg-[#0F151F] rounded-2xl p-6 border border-[#1E2530] grid grid-cols-2 items-center shadow-lg group hover:border-[#2D3748] transition-colors">
               <div className="flex flex-col items-center justify-center">
                   <div className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider mb-1">Wins</div>
                   <div className="text-[#10B981] text-3xl sm:text-5xl font-bold tracking-tight">{currentStats.wins}</div>
               </div>
               <div className="flex items-center justify-center">
                 <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 text-[#10B981]" />
               </div>
           </div>
 
           {/* Losses */}
           <div className="bg-[#0F151F] rounded-2xl p-6 border border-[#1E2530] grid grid-cols-2 items-center shadow-lg group hover:border-[#2D3748] transition-colors">
               <div className="flex flex-col items-center justify-center">
                   <div className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider mb-1">Losses</div>
                   <div className="text-[#FF3069] text-3xl sm:text-5xl font-bold tracking-tight">{currentStats.losses}</div>
               </div>
               <div className="flex items-center justify-center">
                 <TrendingDown className="w-12 h-12 sm:w-16 sm:h-16 text-[#FF3069]" />
               </div>
           </div>
       </div>
 
       {/* HISTORY TABLE SECTION */}
       <div>
         <h2 className="text-white text-lg font-medium mb-4">Trade History</h2>
 
         {/* Desktop Table Header (Hidden on Mobile) */}
         <div className="hidden sm:grid grid-cols-[1.5fr_1.5fr_4fr] bg-[#1E2530] rounded-t-lg px-6 py-3 mb-4 text-[#94A3B8] text-[11px] font-bold uppercase tracking-wider border-b border-[#2D3748]">
            <div className="text-center">Date</div>
            <div className="text-center">Signal</div>
            <div className="grid grid-cols-[1.2fr_0.2fr_1.2fr_1fr] text-right pr-4">
               <div className="text-center">{activeTab === 'intraday' ? 'Entry Price' : 'OpenPrice (D1)'}</div>
               <div></div>{/* Arrow placeholder */}
               <div className="text-center">{activeTab === 'intraday' ? 'Exit Price' : 'OpenPrice (D2)'}</div>
               <div className="text-right">Result</div>
            </div>
         </div>
 
         {/* List Content */}
         <div className="space-y-3">
            {!hasHistory ? (
               <div className="text-center py-12 text-[#94A3B8] bg-[#0F151F] rounded-lg border border-[#1E2530]">No history available for this view.</div>
            ) : (
              historyItemsDisplayed.map((item, idx) => {
                // Use same threshold as accuracy calculation (0.2%)
                const isWin = item.result !== undefined && item.result > 0.2;
                const isLoss = item.result !== undefined && item.result < -0.2;
                const dotColor = isWin ? "bg-[#00FFB7]" : isLoss ? "bg-[#FF3069]" : "bg-[#7588A3]";
 
               // Normalize Price Access between Daily (open_price_d1/d2) and Intraday (entry_price/exit_price)
               const itemAny = item as any;
               const price1 = itemAny.open_price_d1 ?? itemAny.entry_price;
               const price2 = itemAny.open_price_d2 ?? itemAny.exit_price;

                 // Format Time/Date
                let dateDisplay = "";
                if (activeTab === "daily") {
                  const isPending = price2 === undefined || price2 === null;
                  
                  if (isPending && item.start_date) {
                     // Pending/Open trade: Show single date, e.g. "Jan 22, 2026"
                     try {
                         const d1 = parseISO(item.start_date);
                         dateDisplay = format(d1, "MMM dd, yyyy");
                     } catch {
                         dateDisplay = item.start_date;
                     }
                  } else {
                     // Completed trade: Show range, e.g. "Jan 19-20, 2026"
                     try {
                        if (item.start_date && (item as any).date) {
                           const d1 = parseISO(item.start_date);
                           const d2 = parseISO((item as any).date);
                           dateDisplay = `${format(d1, "MMM dd")}-${format(d2, "dd, yyyy")}`;
                        }
                     } catch(e) {
                          dateDisplay = formatDateRange(item.start_date, (item as any).date);
                     }
                  }
                } else {
                  // Intraday mode - show time
                  // Validate that start_time is actually a time format (HH:MM) and not text like "Prev"
                  const isValidTime = (time: string) => /^\d{1,2}:\d{2}/.test(time);
                  
                  const validStartTime = item.start_time && isValidTime(item.start_time) ? item.start_time.substring(0, 5) : "";
                  const validEndTime = item.end_time && isValidTime(item.end_time) ? item.end_time.substring(0, 5) : "";
                  
                  if (validStartTime && validEndTime) {
                    dateDisplay = `${validStartTime} - ${validEndTime}`;
                  } else if (validStartTime) {
                    dateDisplay = validStartTime;
                  } else if (validEndTime) {
                    dateDisplay = validEndTime;
                  }
                  
                  // Add date if available
                  if ((item as any).date) {
                     try { dateDisplay += `, ${format(parseISO((item as any).date), "MMM dd")}`; } catch(e){}
                  }
                }
 
                return (
                  <div key={idx}>
                     {/* MOBILE CARD VIEW (Block on Mobile, Hidden on Desktop) */}
                     <div className="block sm:hidden bg-[#050505] border border-[#1E2530] rounded-xl p-4 hover:border-[#2D3748] transition-colors relative">
                        {/* Status Line Left */}
                        <div className={`absolute left-0 top-4 bottom-4 w-1 ${dotColor} rounded-r`}></div>
                        
                        <div className="pl-3 flex flex-col gap-3">
                           {/* Row 1: Date & Result */}
                           <div className="flex justify-between items-start">
                              <span className="text-[#E2E8F0] text-sm font-medium">{dateDisplay}</span>
                              <div className="text-right">
                                {item.result !== undefined && item.result !== null ? (
                                    <span className={`text-sm font-bold ${isWin ? "text-[#00FFB7]" : "text-[#FF3069]"}`}>
                                        {item.result > 0 ? "+" : ""}{Number(item.result).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                    </span>
                                ) : (
                                    <span className="text-[#64748B] text-xs uppercase tracking-wider">Pending</span>
                                )}
                              </div>
                           </div>
 
                           {/* Row 2: Signal Badges */}
                           <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${item.from_rating.includes("Buy") ? "text-[#00FFB7]" : item.from_rating.includes("Sell") ? "text-[#FF3069]" : "text-[#94A3B8]"}`}>
                                 {item.from_rating}
                              </span>
                              <ArrowRight className="w-3 h-3 text-[#52525B]" />
                              <div className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider ${
                                 item.to_rating === 'Strong Buy' ? 'bg-[#00FFB7]/10 text-[#00FFB7]' :
                                 item.to_rating === 'Buy' ? 'bg-[#00FFB7]/10 text-[#00FFB7]' :
                                 item.to_rating === 'Sell' ? 'bg-[#FF3069]/10 text-[#FF3069]' :
                                 item.to_rating === 'Strong Sell' ? 'bg-[#FF3069]/10 text-[#FF3069]' :
                                 'bg-[#2A3441] text-white'
                              }`}>
                                 {item.to_rating}
                              </div>
                           </div>
 
                           {/* Row 3: Price Flow (Centered) */}
                           <div className="bg-[#0F151F] border border-[#1E2530] rounded-lg p-2 px-3 flex items-center justify-between">
                               {/* Price 1 */}
                               <div className="flex items-baseline gap-1">
                                   <span className="text-[#E2E8F0] font-medium text-sm font-mono tracking-tight">
                                      {price1?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                   <span className="text-[#64748B] text-[8px] font-bold uppercase">{getCurrencyUnit(data.market)}</span>
                               </div>

                               <ArrowRight className="w-3 h-3 text-[#52525B]" />

                               {/* Price 2 */}
                               <div className="flex items-baseline gap-1">
                                   {price2 ? (
                                       <>
                                       <span className="text-[#E2E8F0] font-medium text-sm font-mono tracking-tight">
                                          {price2.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                       <span className="text-[#64748B] text-[8px] font-bold uppercase">{getCurrencyUnit(data.market)}</span>
                                       </>
                                   ) : (
                                       <span className="text-[#64748B] font-medium text-sm tracking-widest">...</span>
                                   )}
                               </div>
                           </div>
                        </div>
                     </div>
 
                     {/* DESKTOP TABLE ROW (Hidden on Mobile, Grid on Desktop) */}
                     <div className="hidden sm:grid bg-[#050505] border border-[#1E2530] rounded-xl px-6 py-4 grid-cols-[1.5fr_1.5fr_4fr] items-center gap-0 hover:border-[#2D3748] transition-colors relative group">
                        
                        {/* Left Dot Indicator */}
                        <div className={`absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-sm ${dotColor}`}></div>
 
                        {/* Date */}
                        <div className="text-[#E2E8F0] text-sm font-medium w-full text-center">
                           {dateDisplay}
                        </div>
 
                        {/* Signal */}
                        <div className="flex items-center justify-center gap-3 w-full">
                           <span className={`text-sm font-medium ${item.from_rating.includes("Buy") ? "text-[#00FFB7]" : item.from_rating.includes("Sell") ? "text-[#FF3069]" : "text-[#94A3B8]"}`}>
                             {item.from_rating}
                           </span>
                           <ArrowRight className="w-3 h-3 text-[#52525B]" />
                           <div className={`px-3 py-1 rounded-[4px] text-[11px] font-bold uppercase tracking-wider ${
                              item.to_rating === 'Strong Buy' ? 'bg-[#00FFB7]/10 text-[#00FFB7]' :
                              item.to_rating === 'Buy' ? 'bg-[#00FFB7]/10 text-[#00FFB7]' :
                              item.to_rating === 'Sell' ? 'bg-[#FF3069]/10 text-[#FF3069]' :
                              item.to_rating === 'Strong Sell' ? 'bg-[#FF3069]/10 text-[#FF3069]' :
                              'bg-[#2A3441] text-white'
                           }`}>
                             {item.to_rating}
                           </div>
                        </div>
 
                        {/* Price & Result Box */}
                        <div className="w-full bg-[#0F151F] border border-[#1E2530] rounded-lg px-6 py-3 grid grid-cols-[1.2fr_0.2fr_1.2fr_1fr] items-center gap-0">
                            
                            {/* Price 1 (Align Center) */}
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-[#E2E8F0] font-medium text-base font-mono tracking-tight">
                                    {price1?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-[#64748B] text-[9px] font-bold uppercase">{getCurrencyUnit(data.market)}</span>
                            </div>

                            {/* Arrow (Center) */}
                            <div className="flex justify-center text-[#52525B]">
                                <ArrowRight className="w-4 h-4" />
                            </div>

                            {/* Price 2 (Align Center) */}
                              <div className="flex items-baseline justify-center gap-1">
                                {price2 ? (
                                    <>
                                    <span className="text-[#E2E8F0] font-medium text-base font-mono tracking-tight">
                                        {price2.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[#64748B] text-[9px] font-bold uppercase">{getCurrencyUnit(data.market)}</span>
                                    </>
                                ) : (
                                    <span className="text-[#64748B] font-medium text-base tracking-widest">...</span>
                                )}
                            </div>

                            {/* Result */}
                            <div className="text-right">
                                {item.result !== undefined && item.result !== null ? (
                                    <span className={`text-base font-bold ${isWin ? "text-[#00FFB7]" : "text-[#FF3069]"}`}>
                                        ({item.result > 0 ? "+" : ""}{Number(item.result).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                                    </span>
                                ) : (
                                    <span className="text-[#64748B] text-sm">Pending</span>
                                )}
                            </div>
                        </div>
                     </div>
                  </div>
                )
              })
            )}
         </div>
       </div>
     </div>
  );
}
