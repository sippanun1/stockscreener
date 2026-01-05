type StatsCardProps = {
  label: string;
  sublabel: string;
  value: string | number;
};

function StatsCard({ label, sublabel, value }: StatsCardProps) {
  return (
    <div className="flex-1 flex items-center justify-between bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 h-[85px]">
      <div>
        <p className="text-[#F8FAFC] text-sm mb-1">{label}</p>
        <p className="text-[#7588A3] text-xs">{sublabel}</p>
      </div>
      <div className="text-[#F8FAFC] text-4xl font-bold">{value}</div>
    </div>
  );
}

type AnalyticsStatsProps = {
  totalSignals: number;
  avgWinRate: number;
  bestMarket: { name: string; winRate: number };
};

export default function AnalyticsStats({ totalSignals, avgWinRate, bestMarket }: AnalyticsStatsProps) {
  return (
    <div className="flex gap-6 mb-8 px-[53px] pt-6">
      <StatsCard
        label="Total Signals This Month"
        sublabel="Total Signals This Month"
        value={totalSignals.toLocaleString()}
      />
      <StatsCard
        label="Average Win Rate"
        sublabel="Above market average"
        value={`${avgWinRate}%`}
      />
      <StatsCard
        label="Best Performing Market"
        sublabel={`${bestMarket.winRate}% win rate`}
        value={bestMarket.name}
      />
    </div>
  );
}
