import type { Stock } from "../types/stock";

type SummaryInfoProps = {
  stocks: Stock[];
};

export default function SummaryInfo({ }: SummaryInfoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 pl-[53px] pr-[53px]">
      {/* Total Stocks */}
      <div className="flex items-center gap-10 bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 w-[320px] h-[95px] pl-10">
        <div>
          <p className="text-[#F8FAFC] text-sm mb-2">Total Signals Today</p>
          <p className="text-[#F8FAFC] text-xs mt-2">↑ 12% from yesterday</p>
        </div>
        <div className="text-[#F8FAFC] text-5xl font-bold">147</div>
      </div>

      <div className="flex items-center gap-10 bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 w-[320px] h-[95px] pl-10">
        <div>
          <p className="text-[#F8FAFC] text-sm mb-2 w-25">Upgrades</p>
          <p className="text-[#F8FAFC] text-xs mt-2">Strong Buy: 34</p>
        </div>
        <div className="text-[#F8FAFC] text-5xl font-bold">89</div>
      </div>

      <div className="flex items-center gap-10 bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 w-[320px] h-[95px] pl-10">
        <div>
          <p className="text-[#F8FAFC] text-sm mb-2">Average Win Rate</p>
          <p className="text-[#F8FAFC] text-xs mt-2">Last 30 days</p>
        </div>
        <div className="text-[#F8FAFC] text-5xl font-bold">67.2%</div>
      </div>

        <div className="flex items-center justify-between bg-[#0F151F] rounded-lg p-6 border border-[#7588A3]/20 w-[320px] h-[95px]">
        <div>
          <p className="text-[#F8FAFC] text-sm mb-2">Best Signal</p>
          <p className="text-[#F8FAFC] text-xs mt-2">+8.92% (5-day)</p>
        </div>
        <div className="text-[#F8FAFC] text-5xl font-bold">NVDA</div>
      </div>
    </div>
  );
}
