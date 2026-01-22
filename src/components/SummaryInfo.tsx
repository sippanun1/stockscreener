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
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 pl-[53px] pr-[53px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#0F151F] rounded-lg p-4 border border-[#7588A3]/20 h-[140px] animate-pulse">
            <div className="h-4 bg-[#7588A3]/20 rounded w-32 mb-4"></div>
            <div className="h-12 bg-[#7588A3]/20 rounded w-20 mb-4"></div>
            <div className="h-2 bg-[#7588A3]/20 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }



  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pl-[53px] pr-[53px]">
      {/* Card 1: POSITIVE / BULLISH */}
      <div className="bg-[#0F151F] rounded-2xl p-4 border border-[#7588A3]/20 flex flex-col justify-between min-h-[120px] h-auto">
        <div className="flex items-start justify-between mb-2">
          <div className="text-[#F8FAFC] text-base font-semibold pt-0.5">
            Positive Signals
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="text-[#F8FAFC] text-4xl font-bold tracking-tight leading-none tabular-nums">
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
      <div className="bg-[#0F151F] rounded-2xl p-4 border border-[#7588A3]/20 flex flex-col justify-between min-h-[120px] h-auto">
        <div className="flex items-start justify-between mb-2">
          <div className="text-[#F8FAFC] text-base font-semibold pt-0.5">
            Negative Signals
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="text-[#F8FAFC] text-4xl font-bold tracking-tight leading-none tabular-nums">
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

      {/* Card 3: TOP GAINERS */}
      <div className="bg-[#0F151F] rounded-2xl p-4 border border-[#7588A3]/20 flex gap-3 min-h-[120px] h-auto overflow-hidden">
        {/* Trophy Icon Section */}
        <div className="flex flex-col items-center justify-center min-w-[60px]">
          <div className="w-10 h-10 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9C6 10.5913 6.63214 12.1174 7.75736 13.2426C8.88258 14.3679 10.4087 15 12 15C13.5913 15 15.1174 14.3679 16.2426 13.2426C17.3679 12.1174 18 10.5913 18 9V3H6V9Z" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 3H4C3.46957 3 2.96086 3.21071 2.58579 3.58579C2.21071 3.96086 2 4.46957 2 5C2 5.53043 2.21071 6.03914 2.58579 6.41421C2.96086 6.78929 3.46957 7 4 7H6" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18 3H20C20.5304 3 21.0391 3.21071 21.4142 3.58579C21.7893 3.96086 22 4.46957 22 5C22 5.53043 21.7893 6.03914 21.4142 6.41421C21.0391 6.78929 20.5304 7 20 7H18" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 15V19" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 21H16" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-[#F8FAFC] text-[10px] font-semibold mt-0.5 whitespace-nowrap">
            Top Gainers
          </div>
        </div>

        {/* Stocks Table */}
        <div className="flex-1 flex flex-col h-full justify-center overflow-y-auto scrollbar-hide">
          {summary.top_opportunities && summary.top_opportunities.length > 0 ? (
            summary.top_opportunities.slice(0, 3).map((stock, index) => (
              <div 
                key={stock.symbol} 
                className="flex items-center gap-2 py-1.5 border-b border-[#7588A3]/10 last:border-b-0"
              >
                {/* Rank */}
                <div className="w-5 text-center">
                  <span className="text-[#F8FAFC] text-xs font-semibold">
                    {index + 1}
                  </span>
                </div>
                
                {/* Symbol */}
                <div className="flex-1 min-w-0">
                  <div className="text-[#F8FAFC] text-sm font-bold truncate">
                    {stock.symbol.split(':')[1] || stock.symbol}
                  </div>
                </div>
                
                {/* Market */}
                <div className="w-16 text-right">
                  <div className="text-[#F8FAFC] text-xs">
                    {stock.market}
                  </div>
                </div>
                
                {/* Percentage */}
                <div className="w-14 text-right">
                  <div className="text-[#10B981] text-xs font-semibold">
                    +{stock.change_percent.toFixed(2)}%
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
