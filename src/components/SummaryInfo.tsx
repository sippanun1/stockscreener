import { useQuery } from "@tanstack/react-query";
import type { Stock } from "../types/stock";

type SummaryInfoProps = {
  stocks: Stock[];
};

type SummaryData = {
  total_signals_today: number;
  upgrades: number;
  strong_buy_count: number;
  date: string;
  change_from_yesterday: number;
  upgrades_change_from_yesterday: number;
  best_signal?: {
    symbol: string;
    market: string;
    name: string;
    change_percent: number;
  };
};

// Fetch function for React Query
const fetchSummary = async (): Promise<SummaryData> => {
  const response = await fetch("http://localhost:8000/api/summary");
  return response.json();
};

export default function SummaryInfo({ }: SummaryInfoProps) {
  // Fetch summary with React Query (5 minute cache)
  const { data: summary, isLoading: loading } = useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 pl-[53px] pr-[53px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-10 bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 w-[320px] h-[95px] pl-10 animate-pulse">
            <div className="flex-1">
              <div className="h-4 bg-[#7588A3]/20 rounded w-32 mb-2"></div>
              <div className="h-3 bg-[#7588A3]/20 rounded w-24 mt-2"></div>
            </div>
            <div className="h-12 bg-[#7588A3]/20 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 pl-[53px] pr-[53px]">
      {/* Total Signals Today */}
      <div className="flex items-center justify-between bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 w-full h-[95px]">
        <div className="flex-1 min-w-0">
          <p className="text-[#F8FAFC] text-sm mb-2">Total Signals Today</p>
          <p className={`text-sm mt-2 ${summary.change_from_yesterday >= 0 ? 'text-[#00FFB7]' : 'text-[#FF3069]'}`}>
            {summary.change_from_yesterday >= 0 ? '↑' : '↓'} {Math.abs(summary.change_from_yesterday)}% from yesterday
          </p>
        </div>
        <div className="text-[#F8FAFC] text-4xl font-bold ml-4">{summary.total_signals_today.toLocaleString()}</div>
      </div>

      {/* Upgrades */}
      <div className="flex items-center justify-between bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 w-full h-[95px]">
        <div className="flex-1 min-w-0">
          <p className="text-[#F8FAFC] text-sm mb-2">Upgrades</p>
          <p className="text-[#F8FAFC] text-sm mt-2">{summary.strong_buy_count.toLocaleString()} Strong Buy</p>
        </div>
        <div className="text-[#F8FAFC] text-4xl font-bold ml-4">{summary.upgrades.toLocaleString()}</div>
      </div>

      {/* Best Signal */}
      <div className="flex items-center justify-between bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 w-full h-[95px]">
        <div className="flex-1 min-w-0">
          <p className="text-[#F8FAFC] text-sm mb-2">Best Signal</p>
          {summary.best_signal ? (
             <p className="text-[#00FFB7] text-sm mt-2">+{summary.best_signal.change_percent.toFixed(2)}% Today</p>
          ) : (
             <p className="text-[#7588A3] text-sm mt-2">No signals yet</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-[#F8FAFC] text-4xl font-bold">
            {summary.best_signal ? summary.best_signal.symbol : "—"}
          </div>
          {summary.best_signal && summary.best_signal.name && (
            <div className="text-[#7588A3] text-sm mt-1 truncate max-w-[200px]">
              {summary.best_signal.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

