import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Stock } from "../types/stock";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

type SummaryInfoProps = {
  stocks: Stock[];
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

type StockByRating = {
  symbol: string;
  market: string;
  name: string;
  current_price: number;
  current_rating: string;
  previous_rating: string;
};

// Fetch function for React Query
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fetchSummary = async (): Promise<SummaryData> => {
  const response = await fetch(`${API_URL}/api/summary`);
  return response.json();
};

const fetchStocksByRating = async (rating: string): Promise<StockByRating[]> => {
  const response = await fetch(`${API_URL}/api/stocks/by-rating?rating=${encodeURIComponent(rating)}`);
  const data = await response.json();
  return data.data || [];
};

export default function SummaryInfo({ }: SummaryInfoProps) {
  const [selectedRating, setSelectedRating] = useState<string | null>(null);

  // Fetch summary with React Query (5 minute cache)
  const { data: summary, isLoading: loading } = useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Fetch stocks by rating when a rating is selected
  const { data: stocksByRating, isLoading: loadingStocks } = useQuery({
    queryKey: ['stocksByRating', selectedRating],
    queryFn: () => fetchStocksByRating(selectedRating!),
    enabled: !!selectedRating,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 pl-[53px] pr-[53px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 h-[160px] animate-pulse">
            <div className="h-4 bg-[#7588A3]/20 rounded w-32 mb-4"></div>
            <div className="h-12 bg-[#7588A3]/20 rounded w-20 mb-4"></div>
            <div className="h-2 bg-[#7588A3]/20 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }



  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 pl-[53px] pr-[53px]">
      {/* Card 1: POSITIVE / BULLISH */}
      <div className="bg-[#0F151F] rounded-2xl p-3 border border-[#7588A3]/20 flex flex-col">
        <div>
          <div className="text-[#F8FAFC] text-sm font-medium">
            Positive Signals
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-end justify-center">
          <div className="text-[#F8FAFC] text-6xl font-bold tracking-tight">
            {summary.upgrades.toLocaleString()}
          </div>
          <div className="text-[#7588A3] text-sm font-medium mt-1">
            total signal
          </div>
        </div>

        {/* Progress Bar Group */}
        <div className="mt-2">
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

          <div className="flex items-center justify-between text-xs mt-1.5 font-medium">
          <Popover>
            <PopoverTrigger asChild>
              <button 
                onClick={() => setSelectedRating("Strong Buy")}
                className="text-[#00FFB7] hover:text-[#00FFB7]/80 transition-colors cursor-pointer hover:underline"
              >
                Strong Buy ({summary.strong_buy_count})
              </button>
            </PopoverTrigger>
            <PopoverContent 
              align="center" 
              side="bottom"
              className="w-80 max-h-96 overflow-y-auto bg-[#0F151F] border-[#7588A3]/20 z-[100]"
            >
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-[#F8FAFC]">Strong Buy Signals ({summary.strong_buy_count})</h3>
                {loadingStocks ? (
                  <div className="text-[#7588A3] text-xs">Loading...</div>
                ) : stocksByRating && stocksByRating.length > 0 ? (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-[#7588A3]/30 scrollbar-track-transparent">
                    {stocksByRating.map((stock) => (
                      <div key={stock.symbol} className="flex items-center justify-between text-xs border-b border-[#7588A3]/10 pb-1.5">
                        <div>
                          <div className="text-[#F8FAFC] font-medium">{stock.symbol.split(':')[1] || stock.symbol}</div>
                          <div className="text-[#7588A3] text-[10px]">{stock.market}</div>
                        </div>
                        <div className="text-[#00FFB7] font-medium">${stock.current_price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[#7588A3] text-xs">No stocks found</div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <button 
                onClick={() => setSelectedRating("Buy")}
                className="text-[#10B981] hover:text-[#10B981]/80 transition-colors cursor-pointer hover:underline"
              >
                Buy ({summary.buy_count || 0})
              </button>
            </PopoverTrigger>
            <PopoverContent 
              align="center" 
              side="bottom"
              className="w-80 max-h-96 overflow-y-auto bg-[#0F151F] border-[#7588A3]/20 z-[100]"
            >
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-[#F8FAFC]">Buy Signals ({summary.buy_count || 0})</h3>
                {loadingStocks ? (
                  <div className="text-[#7588A3] text-xs">Loading...</div>
                ) : stocksByRating && stocksByRating.length > 0 ? (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-[#7588A3]/30 scrollbar-track-transparent">
                    {stocksByRating.map((stock) => (
                      <div key={stock.symbol} className="flex items-center justify-between text-xs border-b border-[#7588A3]/10 pb-1.5">
                        <div>
                          <div className="text-[#F8FAFC] font-medium">{stock.symbol.split(':')[1] || stock.symbol}</div>
                          <div className="text-[#7588A3] text-[10px]">{stock.market}</div>
                        </div>
                        <div className="text-[#10B981] font-medium">${stock.current_price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[#7588A3] text-xs">No stocks found</div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          </div>

        </div>
      </div>

      {/* Card 2: NEGATIVE / BEARISH */}
      <div className="bg-[#0F151F] rounded-2xl p-3 border border-[#7588A3]/20 flex flex-col">
        <div>
          <div className="text-[#F8FAFC] text-sm font-medium">
            Negative Signals
          </div>
        </div>

        <div className="flex-1 flex flex-col items-end justify-center">
          <div className="text-[#F8FAFC] text-6xl font-bold tracking-tight">
            {summary.downgrades?.toLocaleString() || 0}
          </div>
          <div className="text-[#7588A3] text-sm font-medium mt-1">
            total signal
          </div>
        </div>

        {/* Progress Bar Group */}
        <div className="mt-2">
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

          <div className="flex items-center justify-between text-xs mt-1.5 font-medium">
          <Popover>
            <PopoverTrigger asChild>
              <button 
                onClick={() => setSelectedRating("Strong Sell")}
                className="text-[#FF3069] hover:text-[#FF3069]/80 transition-colors cursor-pointer hover:underline"
              >
                Strong Sell ({summary.strong_sell_count || 0})
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-96 overflow-y-auto bg-[#0F151F] border-[#7588A3]/20">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-[#F8FAFC]">Strong Sell Signals ({summary.strong_sell_count || 0})</h3>
                {loadingStocks ? (
                  <div className="text-[#7588A3] text-xs">Loading...</div>
                ) : stocksByRating && stocksByRating.length > 0 ? (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {stocksByRating.map((stock) => (
                      <div key={stock.symbol} className="flex items-center justify-between text-xs border-b border-[#7588A3]/10 pb-1.5">
                        <div>
                          <div className="text-[#F8FAFC] font-medium">{stock.symbol.split(':')[1] || stock.symbol}</div>
                          <div className="text-[#7588A3] text-[10px]">{stock.market}</div>
                        </div>
                        <div className="text-[#FF3069] font-medium">${stock.current_price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[#7588A3] text-xs">No stocks found</div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <button 
                onClick={() => setSelectedRating("Sell")}
                className="text-[#DC2626] hover:text-[#DC2626]/80 transition-colors cursor-pointer hover:underline"
              >
                Sell ({summary.sell_count || 0})
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-96 overflow-y-auto bg-[#0F151F] border-[#7588A3]/20">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-[#F8FAFC]">Sell Signals ({summary.sell_count || 0})</h3>
                {loadingStocks ? (
                  <div className="text-[#7588A3] text-xs">Loading...</div>
                ) : stocksByRating && stocksByRating.length > 0 ? (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {stocksByRating.map((stock) => (
                      <div key={stock.symbol} className="flex items-center justify-between text-xs border-b border-[#7588A3]/10 pb-1.5">
                        <div>
                          <div className="text-[#F8FAFC] font-medium">{stock.symbol.split(':')[1] || stock.symbol}</div>
                          <div className="text-[#7588A3] text-[10px]">{stock.market}</div>
                        </div>
                        <div className="text-[#DC2626] font-medium">${stock.current_price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[#7588A3] text-xs">No stocks found</div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          </div>

        </div>
      </div>

      {/* Card 3: TOP OPPORTUNITIES */}
      <div className="bg-[#0F151F] rounded-2xl p-3 border border-[#7588A3]/20 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#6366F1] text-[11px] font-bold uppercase tracking-wide">
            TOP OPPORTUNITIES
          </span>
          <span className="text-[#7588A3] text-[9px] px-1.5 py-0.5 bg-[#1E293B] rounded border border-[#7588A3]/20">
            High Confidence
          </span>
        </div>

        {/* Top stocks list */}
        <div className="space-y-1.5">
          {summary.top_opportunities && summary.top_opportunities.length > 0 ? (
            summary.top_opportunities.slice(0, 3).map((stock, index) => (
              <div key={stock.symbol} className="flex items-center gap-2">
                {/* Rank Number */}
                <div className="flex-shrink-0 w-4 text-center">
                  <span className="text-[#6366F1] text-sm font-bold">
                    {index + 1}
                  </span>
                </div>
                
                {/* Stock Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[#F8FAFC] text-sm font-bold truncate">
                    {stock.symbol.split(':')[1] || stock.symbol}
                  </div>
                  <div className="text-[#7588A3] text-[10px] leading-tight">
                    {stock.market}
                  </div>
                </div>
                
                {/* Percentage Change */}
                <div className="text-[#00FFB7] text-sm font-bold whitespace-nowrap">
                  +{stock.change_percent.toFixed(2)}%
                </div>
              </div>
            ))
          ) : (
            <div className="text-[#7588A3] text-xs text-center py-4">
              No opportunities
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
