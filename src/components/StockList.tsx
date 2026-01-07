import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Stock } from "../types/stock";

type StockTableProps = {
  stocks: Stock[];
};

const getRatingColor = (rating: string | undefined) => {
  if (!rating) return "bg-[#354052]";
  switch (rating) {
    case "Strong Buy":
      return "bg-[#065F46]";
    case "Buy":
      return "bg-[#007957]";
    case "Neutral":
      return "bg-[#6B7280]";
    case "Sell":
      return "bg-[#CE0F44]";
    case "Strong Sell":
      return "bg-[#A10F38]";
    default:
      return "bg-[#6B7280]";
  }
};

// Column widths for consistent sizing
const COLUMNS = [
  { key: "symbol", label: "Symbol", width: "w-[120px]" },
  { key: "exchange", label: "Exchange", width: "w-[100px]" },
  { key: "price", label: "Price", width: "w-[120px]" },
  { key: "change", label: "Change", width: "w-[100px]" },
  { key: "changePercent", label: "Change%", width: "w-[100px]" },
  { key: "prevRating", label: "Previous Rating", width: "w-[120px]" },
  { key: "arrow", label: "", width: "w-[40px]" },
  { key: "currRating", label: "Current Rating", width: "w-[120px]" },
  { key: "date", label: "Date", width: "w-[100px]" },
  { key: "backtest", label: "Backtest (5D)", width: "w-[120px]" },
];

const ROW_HEIGHT = 40;
const TABLE_HEIGHT = 600;

export default function StockTable({ stocks }: StockTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const virtualizer = useVirtualizer({
    count: stocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // Render 10 extra rows above/below viewport
  });

  const calculateChange = (stock: Stock) => {
    if (!stock.previous_price) return 0;
    return stock.current_price - stock.previous_price;
  };

  const calculateChangePercent = (stock: Stock) => {
    if (!stock.previous_price) return 0;
    return ((stock.current_price - stock.previous_price) / stock.previous_price) * 100;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-[#10B981]";
    if (change < 0) return "text-[#EF4444]";
    return "text-[#7588A3]";
  };

  return (
    <div className="ml-[53px] mr-[53px] mt-[17px]">
      {/* Stats bar */}
      <div className="flex justify-between items-center mb-2 text-sm text-[#7588A3]">
        <span>Showing {stocks.length.toLocaleString()} stocks</span>
        <span>Scroll to load more</span>
      </div>

      {/* Table Header (fixed) */}
      <div className="bg-[#0F151F] flex border-b border-white/10">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`${col.width} text-[#F8FAFC] uppercase text-xs text-center py-3 px-2 font-medium flex-shrink-0`}
          >
            {col.key === "arrow" ? (
              <img src="/src/assets/arrow.svg" alt="arrow" className="h-4 mx-auto" />
            ) : (
              col.label
            )}
          </div>
        ))}
      </div>

      {/* Virtual scrolling body */}
      <div
        ref={parentRef}
        className="overflow-auto bg-[#0a0f16]"
        style={{ height: TABLE_HEIGHT }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const s = stocks[virtualRow.index];
            const change = calculateChange(s);
            const changePercent = calculateChangePercent(s);

            return (
              <div
                key={virtualRow.key}
                className="absolute top-0 left-0 w-full flex items-center bg-[#7588A31A] hover:bg-[#292D33]/80 border-b border-white/5 cursor-pointer"
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => navigate(`/stock/${encodeURIComponent(s.symbol)}`)}
              >
                {/* Symbol - ticker part after colon (e.g., NVDA, GOOG, BBL) */}
                <div className="w-[120px] text-[#F8FAFC] font-semibold text-center text-sm flex-shrink-0 px-2">
                  {s.symbol.split(":")[1] || s.name}
                </div>

                {/* Exchange - exchange part before colon (e.g., NASDAQ, SET, HKEX) */}
                <div className="w-[100px] text-[#7588A3] text-center text-sm flex-shrink-0 px-2 truncate">
                  {s.symbol.split(":")[0]}
                </div>

                {/* Price */}
                <div className="w-[120px] text-[#F8FAFC] text-right text-sm flex-shrink-0 px-2">
                  ${Number(s.current_price).toFixed(2)}
                </div>

                {/* Change */}
                <div className={`w-[100px] text-right text-sm flex-shrink-0 px-2 ${getChangeColor(change)}`}>
                  {change > 0 ? "+" : ""}{change.toFixed(2)}
                </div>

                {/* Change % */}
                <div className={`w-[100px] text-right text-sm flex-shrink-0 px-2 ${getChangeColor(changePercent)}`}>
                  {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%
                </div>

                {/* Previous Rating */}
                <div className="w-[120px] flex justify-center flex-shrink-0 px-2">
                  <div
                    className={`w-[91px] h-[20px] ${getRatingColor(s.Previous_Rating)} text-[#F8FAFC] rounded-[16px] flex items-center justify-center text-xs font-semibold`}
                  >
                    {s.Previous_Rating || "N/A"}
                  </div>
                </div>

                {/* Arrow */}
                <div className="w-[40px] flex justify-center flex-shrink-0">
                  <img src="/src/assets/arrow.svg" alt="arrow" className="h-3" />
                </div>

                {/* Current Rating */}
                <div className="w-[120px] flex justify-center flex-shrink-0 px-2">
                  <div
                    className={`w-[91px] h-[20px] ${getRatingColor(s.Technical_Rating)} text-[#F8FAFC] rounded-[16px] flex items-center justify-center text-xs font-semibold`}
                  >
                    {s.Technical_Rating}
                  </div>
                </div>

                {/* Date */}
                <div className="w-[100px] text-[#7588A3] text-center text-sm flex-shrink-0 px-2 truncate">
                  {s.fetched_date || ""}
                </div>

                {/* Backtest */}
                <div className="w-[120px] text-[#7588A3] text-center text-sm flex-shrink-0 px-2">
                  -
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
