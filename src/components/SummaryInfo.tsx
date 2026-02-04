import { useQuery } from "@tanstack/react-query";

import type { Stock } from "../types/stock";

// Currency symbol helper
const getCurrencySymbol = (market: string | undefined) => {
  switch (market?.toUpperCase()) {
    case "TH":
      return "THB"
    case "HK":
      return "HKD"
    case "JP":
      return "JPY"
    case "US":
      return "USD"
    case "IN":
      return "INR"
    case "VN":
      return "VND"
    case "UK":
      return "GBX"
    default:
      return "USD"
  }
}


type SummaryInfoProps = {
  stocks: Stock[];
  onFilterChange?: (technicalRating: string) => void;
};

type SummaryData = {
  total_signals_today: number;
  upgrades: number;
  downgrades: number;
  strong_buy_count: number;
  buy_count: number;
  strong_sell_count: number;
  sell_count: number;
  date: string;
  change_from_yesterday: number;
  upgrades_change_from_yesterday: number;
  top_opportunities?: Array<{
    symbol: string;
    market: string;
    name: string;
    change_percent: number;
  }>;
};



// Fetch function for React Query
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fetchSummary = async (): Promise<SummaryData> => {
  const response = await fetch(`${API_URL}/api/summary`);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

export default function SummaryInfo({ onFilterChange }: SummaryInfoProps) {
  // Fetch summary with React Query (5 minute cache)
  const { data: summary, isLoading: loading } = useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 px-4 sm:px-6 lg:px-[53px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#0F151F] rounded-lg p-4 border border-[#7588A3]/20 h-[120px] sm:h-[140px] animate-pulse">
            <div className="h-4 bg-[#7588A3]/20 rounded w-24 sm:w-32 mb-4"></div>
            <div className="h-8 sm:h-12 bg-[#7588A3]/20 rounded w-16 sm:w-20 mb-4"></div>
            <div className="h-2 bg-[#7588A3]/20 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }



  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6 px-4 sm:px-6 lg:px-[53px]">
      {/* Card 1: POSITIVE / BULLISH */}
      <div 
        onClick={() => onFilterChange?.('Positive')}
        className="bg-[#0F151F] rounded-2xl p-4 border border-[#7588A3]/20 flex flex-col justify-between min-h-[120px] h-auto cursor-pointer hover:bg-[#0F151F]/80 transition-colors"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="text-[#F8FAFC] text-sm sm:text-base font-semibold pt-0.5">
            Positive Signals
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="text-[#F8FAFC] text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-none tabular-nums">
              {summary.upgrades.toLocaleString()}
            </div>
            <div className="text-[#7588A3] text-[10px] font-medium mt-1">
              total signal
            </div>
          </div>
        </div>

        {/* Progress Bar Group */}
        <div>
          {/* Split Bar */}
          <div className="h-3 w-full bg-[#1E293B] rounded-full overflow-hidden flex border border-[#1E293B]">
            {/* Strong Buy Segment */}
            <div 
              className="h-full bg-[#00FFB7] transition-all duration-300"
              style={{ width: `${summary.strong_buy_count + summary.buy_count > 0 ? (summary.strong_buy_count / (summary.strong_buy_count + summary.buy_count)) * 100 : 0}%` }}
            ></div>
            {/* Buy Segment */}
            <div 
              className="h-full bg-[#10B981] transition-all duration-300"
              style={{ width: `${summary.strong_buy_count + summary.buy_count > 0 ? (summary.buy_count / (summary.strong_buy_count + summary.buy_count)) * 100 : 0}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-xs mt-2 font-medium">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterChange?.("Strong Buy");
                }}
                className="text-[#00FFB7] hover:text-[#00FFB7]/80 transition-colors cursor-pointer hover:underline"
              >
                Strong Buy ({summary.strong_buy_count})
              </button>
          
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterChange?.("Buy");
                }}
                className="text-[#10B981] hover:text-[#10B981]/80 transition-colors cursor-pointer hover:underline"
              >
                Buy ({summary.buy_count || 0})
              </button>
          </div>

        </div>
      </div>

      {/* Card 2: NEGATIVE / BEARISH */}
      <div 
        onClick={() => onFilterChange?.('Negative')}
        className="bg-[#0F151F] rounded-2xl p-4 border border-[#7588A3]/20 flex flex-col justify-between min-h-[120px] h-auto cursor-pointer hover:bg-[#0F151F]/80 transition-colors"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="text-[#F8FAFC] text-sm sm:text-base font-semibold pt-0.5">
            Negative Signals
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="text-[#F8FAFC] text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-none tabular-nums">
              {(summary.downgrades || 0).toLocaleString()}
            </div>
            <div className="text-[#7588A3] text-[10px] font-medium mt-1">
              total signal
            </div>
          </div>
        </div>

        {/* Progress Bar Group */}
        <div>
          {/* Split Bar */}
          <div className="h-3 w-full bg-[#1E293B] rounded-full overflow-hidden flex border border-[#1E293B]">
             {/* Strong Sell Segment */}
            <div 
              className="h-full bg-[#FF3069] transition-all duration-300"
              style={{ width: `${summary.strong_sell_count + summary.sell_count > 0 ? (summary.strong_sell_count / (summary.strong_sell_count + summary.sell_count)) * 100 : 0}%` }}
            ></div>
            {/* Sell Segment */}
            <div 
              className="h-full bg-[#DC2626] transition-all duration-300"
              style={{ width: `${summary.strong_sell_count + summary.sell_count > 0 ? (summary.sell_count / (summary.strong_sell_count + summary.sell_count)) * 100 : 0}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-xs mt-2 font-medium">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterChange?.("Strong Sell");
                }}
                className="text-[#FF3069] hover:text-[#FF3069]/80 transition-colors cursor-pointer hover:underline"
              >
                Strong Sell ({summary.strong_sell_count || 0})
              </button>
          
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterChange?.("Sell");
                }}
                className="text-[#DC2626] hover:text-[#DC2626]/80 transition-colors cursor-pointer hover:underline"
              >
                Sell ({summary.sell_count || 0})
              </button>
          </div>

        </div>
      </div>

      {/* Card 3: TOP GAINERS */}
      <div 
        onClick={() => onFilterChange?.('Top Gainers')}
        className="bg-[#0F151F] rounded-2xl p-4 border border-[#7588A3]/20 flex gap-3 min-h-[120px] h-auto overflow-hidden cursor-pointer hover:bg-[#0F151F]/80 transition-colors"
      >
        {/* Trophy Icon Section */}
        <div className="flex flex-col items-center justify-center min-w-[85px] sm:min-w-[120px] border-r border-[#7588A3]/10 pr-3 sm:pr-4">
          <div className="w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center mb-1">
            <svg className="w-10 h-10 sm:w-16 sm:h-16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9C6 10.5913 6.63214 12.1174 7.75736 13.2426C8.88258 14.3679 10.4087 15 12 15C13.5913 15 15.1174 14.3679 16.2426 13.2426C17.3679 12.1174 18 10.5913 18 9V3H6V9Z" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 3H4C3.46957 3 2.96086 3.21071 2.58579 3.58579C2.21071 3.96086 2 4.46957 2 5C2 5.53043 2.21071 6.03914 2.58579 6.41421C2.96086 6.78929 3.46957 7 4 7H6" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18 3H20C20.5304 3 21.0391 3.21071 21.4142 3.58579C21.7893 3.96086 22 4.46957 22 5C22 5.53043 21.7893 6.03914 21.4142 6.41421C21.0391 6.78929 20.5304 7 20 7H18" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 15V19" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 21H16" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-[#F8FAFC] text-[10px] sm:text-sm font-bold tracking-tight uppercase mt-1 whitespace-nowrap">
            Top Gainers
          </div>
        </div>

        {/* Stocks Table */}
        <div className="flex-1 flex flex-col h-full justify-center overflow-y-auto scrollbar-hide">
          {summary.top_opportunities && summary.top_opportunities.length > 0 ? (
            summary.top_opportunities.slice(0, 3).map((stock, index) => (
              <div 
                key={stock.symbol} 
                className="grid grid-cols-[18px_1fr_48px_110px] sm:grid-cols-[20px_1fr_55px_120px] gap-1.5 sm:gap-2 items-center py-1.5 border-b border-[#7588A3]/10 last:border-b-0"
              >
                {/* Rank */}
                <div className="text-center">
                  <span className="text-[#F8FAFC] text-[10px] sm:text-xs font-semibold">
                    {index + 1}
                  </span>
                </div>
                
                {/* Symbol */}
                <div className="min-w-0">
                  <div className="text-[#F8FAFC] text-xs sm:text-sm font-bold truncate">
                    {stock.symbol.split(':')[1] || stock.symbol}
                  </div>
                </div>
                
                {/* Exchange */}
                <div className="text-left">
                  <div className="text-[#F8FAFC] text-[10px] sm:text-[11px] font-medium opacity-80 uppercase">
                    {stock.symbol.split(':')[0] || stock.market}
                  </div>
                </div>
                
                {/* Percentage */}
                <div className="text-right">
                  <div className="text-[#00FFB7] text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                    +{stock.change_percent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% <span className="text-[#F8FAFC] text-[9px] sm:text-[10px]">{getCurrencySymbol(stock.market)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-[#7588A3] text-xs text-center py-4">
              No gainers today
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
