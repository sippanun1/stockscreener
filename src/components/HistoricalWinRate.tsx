import { useState } from "react";

type SignalData = {
  signal: string;
  winRate: number;
  color: string;
};

type HistoricalWinRateProps = {
  data: SignalData[];
};

export default function HistoricalWinRate({ data }: HistoricalWinRateProps) {
  const [hoveredItem, setHoveredItem] = useState<SignalData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent, item: SignalData) => {
    setTooltipPosition({
      x: e.clientX,
      y: e.clientY,
    });
    setHoveredItem(item);
  };

  return (
    <div className="bg-[#0F151F] rounded-lg border border-[#7588A3]/20 mx-[53px] p-6">
      <h3 className="text-[#F8FAFC] text-lg font-semibold mb-6">Historical win rate</h3>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.signal} className="flex items-center gap-4">
            <div className="w-20 text-[#7588A3] text-sm text-right">{item.signal}</div>
            <div 
              className="relative flex-1 h-6 bg-[#1A202C] rounded cursor-pointer"
              onMouseMove={(e) => handleMouseMove(e, item)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div
                className="h-full rounded-r transition-all duration-200 hover:opacity-80"
                style={{
                  width: `${item.winRate}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
        {/* X-axis labels */}
        <div className="flex items-center gap-4 mt-4">
          <div className="w-20" />
          <div className="flex-1 flex justify-between text-[#7588A3] text-xs">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Fixed position tooltip that follows cursor */}
      {hoveredItem && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: `${tooltipPosition.x + 15}px`,
            top: `${tooltipPosition.y - 70}px`,
          }}
        >
          <div className="bg-[#1F2937] border border-[#7588A3]/30 rounded-lg shadow-xl px-4 py-3 min-w-[140px]">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: hoveredItem.color }}
              />
              <span className="text-[#F8FAFC] font-semibold text-sm">{hoveredItem.signal}</span>
            </div>
            <div className="text-[#7588A3] text-xs mb-1">Win Rate</div>
            <div className="text-[#00FF88] text-xl font-bold">{hoveredItem.winRate}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
