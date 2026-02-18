import { useQuery } from "@tanstack/react-query";

import type { Stock } from "../types/stock";



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
  top_accuracy?: Array<{
    symbol: string;
    market: string;
    name: string;
    accuracy: number;
    total_signals?: number;
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
  // Fetch summary with React Query (30 minute cache)
  const { data: summary, isLoading: loading } = useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
    staleTime: 30 * 60 * 1000, // 30 minutes - optimized cache
    gcTime: 60 * 60 * 1000, // Keep in cache for 60 minutes
    refetchOnWindowFocus: false, // Don't refetch when user returns to tab
    refetchOnMount: false, // Don't refetch if data is fresh
  });

  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 px-4 sm:px-6 lg:px-[53px]">
        {[1, 2, 3, 4].map((i) => (
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3 sm:mb-4 px-4 sm:px-6 lg:px-[53px]">
      {/* Card 1: POSITIVE / BULLISH */}
      <div 
        onClick={() => onFilterChange?.('Positive')}
        className="bg-[#0F151F] rounded-2xl p-3.5 border border-[#7588A3]/20 flex flex-col justify-between min-h-[110px] h-auto cursor-pointer hover:bg-[#0F151F]/80 transition-colors"
      >
        <div className="flex items-start justify-start mb-2">
          <div className="text-[#F8FAFC] text-xs sm:text-sm font-semibold pt-0.5">
            Positive Signals
          </div>
        </div>
        <div className="flex flex-col items-end justify-center flex-1 mb-2">
          <div className="text-[#F8FAFC] text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight leading-none tabular-nums">
            {summary.upgrades.toLocaleString()}
          </div>
          <div className="text-[#7588A3] text-[10px] font-medium mt-1">
            total signal
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
        className="bg-[#0F151F] rounded-2xl p-3.5 border border-[#7588A3]/20 flex flex-col justify-between min-h-[110px] h-auto cursor-pointer hover:bg-[#0F151F]/80 transition-colors"
      >
        <div className="flex items-start justify-start mb-2">
          <div className="text-[#F8FAFC] text-xs sm:text-sm font-semibold pt-0.5">
            Negative Signals
          </div>
        </div>
        <div className="flex flex-col items-end justify-center flex-1 mb-2">
          <div className="text-[#F8FAFC] text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight leading-none tabular-nums">
            {(summary.downgrades || 0).toLocaleString()}
          </div>
          <div className="text-[#7588A3] text-[10px] font-medium mt-1">
            total signal
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
        className="bg-[#0F151F] rounded-2xl p-3.5 border border-[#7588A3]/20 flex flex-col min-h-[110px] h-auto overflow-hidden cursor-pointer hover:bg-[#0F151F]/80 transition-colors"
      >
        {/* Title */}
        <div className="text-[#F8FAFC] text-xs sm:text-sm font-bold uppercase mb-2 shrink-0">Top Gainers</div>

        {/* Stocks Table */}
        <div className="flex-1 flex flex-col justify-center overflow-hidden">
          {summary.top_opportunities && summary.top_opportunities.length > 0 ? (
            summary.top_opportunities.slice(0, 3).map((stock, index) => (
              <div 
                key={stock.symbol} 
                className="grid grid-cols-[20px_1fr_auto] gap-2 items-center py-1.5 border-b border-[#7588A3]/10 last:border-b-0"
              >
                {/* Rank */}
                <span className="text-[#7588A3] text-[10px] sm:text-xs font-semibold text-center">{index + 1}</span>
                
                {/* Symbol & Company Name */}
                <div className="min-w-0">
                  <div className="text-[#F8FAFC] text-xs sm:text-sm font-bold truncate leading-tight">
                    {stock.symbol.split(':')[1] || stock.symbol}
                  </div>
                  <div className="text-[#7588A3] text-[9px] sm:text-[10px] truncate leading-tight">
                    {stock.name || (stock.symbol.split(':')[0] || stock.market)}
                  </div>
                </div>
                
                {/* Percentage */}
                <div className="text-[#00FFB7] text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                  +{stock.change_percent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
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

       {/* Card 4: TOP ACCURACY */}
       <div 
        onClick={() => onFilterChange?.('Top Accuracy')}
        className="bg-[#0F151F] rounded-2xl p-3.5 border border-[#7588A3]/20 flex flex-col min-h-[110px] h-auto overflow-hidden cursor-pointer hover:bg-[#0F151F]/80 transition-colors"
      >
        {/* Title */}
        <div className="flex items-baseline gap-1.5 mb-2 shrink-0">
          <span className="text-[#F8FAFC] text-xs sm:text-sm font-bold uppercase">Top Accuracy</span>
          <span className="text-[#7588A3] text-[9px] sm:text-[10px] font-medium">All Time</span>
        </div>

        {/* Stocks Table */}
        <div className="flex-1 flex flex-col justify-center overflow-hidden">
          {summary.top_accuracy && summary.top_accuracy.length > 0 ? (
            summary.top_accuracy.slice(0, 3).map((stock, index) => (
              <div 
                key={stock.symbol} 
                className="grid grid-cols-[20px_1fr_auto] gap-2 items-center py-1.5 border-b border-[#7588A3]/10 last:border-b-0"
              >
                {/* Rank */}
                <span className="text-[#7588A3] text-[10px] sm:text-xs font-semibold text-center">{index + 1}</span>
                
                {/* Symbol & Company Name */}
                <div className="min-w-0">
                  <div className="text-[#F8FAFC] text-xs sm:text-sm font-bold truncate leading-tight">
                    {stock.symbol.split(':')[1] || stock.symbol}
                  </div>
                  <div className="text-[#7588A3] text-[9px] sm:text-[10px] truncate leading-tight">
                    {stock.name || (stock.symbol.split(':')[0] || stock.market)}
                  </div>
                </div>
                
                {/* Accuracy */}
                <div className="text-right">
                  <div className={`text-[11px] sm:text-xs font-semibold whitespace-nowrap ${stock.accuracy >= 50 ? 'text-[#00FFB7]' : 'text-[#FF3069]'}`}>
                    {stock.accuracy.toFixed(0)}%
                  </div>
                  <div className="text-[#7588A3] text-[9px] font-medium">
                    {stock.total_signals || 0} signals
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-[#7588A3] text-xs text-center py-4">
              No historical data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
