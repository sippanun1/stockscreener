"use client"
import { format, isToday, isYesterday, parseISO } from "date-fns"
import { Link } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import type { Stock } from "@/types/stock"
import { StockLogo } from "@/components/StockLogo"
import { LongArrowRight } from "@/components/LongArrowRight"

const getRatingColor = (rating: string | undefined) => {
  if (!rating) return "bg-[#354052]"
  switch (rating) {
    case "Strong Buy":
      return "bg-[#065F46]"
    case "Buy":
      return "bg-[#007957]"
    case "Neutral":
      return "bg-[#6B7280]"
    case "Sell":
      return "bg-[#CE0F44]"
    case "Strong Sell":
      return "bg-[#A10F38]"
    default:
      return "bg-[#6B7280]"
  }
}

export const stockColumns: ColumnDef<Stock>[] = [
  {
    accessorKey: "symbol",
    header: "Symbol",
    cell: ({ row }) => {
      const symbol = row.getValue("symbol") as string
      // Extract clean symbol for display (e.g. "NVDA")
      const displaySymbol = symbol.split(":")[1] || symbol
      return (
        <div className="flex items-center gap-3">
          <StockLogo symbol={symbol} name={row.original.name} />
          <div className="text-[#F8FAFC] font-semibold text-sm">
            {displaySymbol}
          </div>
        </div>
      )
    },
  },
  {
    accessorFn: (row) => row.symbol.split(":")[0],
    id: "exchange",
    header: "Exchange",
    cell: ({ row }) => {
      const symbol = row.original.symbol
      return (
        <div className="text-[#7588A3] text-sm">
          {symbol.split(":")[0]}
        </div>
      )
    },
  },
  {
    accessorKey: "current_price",
    header: "Price",
    cell: ({ row }) => {
      const price = parseFloat(row.getValue("current_price"))
      return (
        <div className="text-[#F8FAFC] text-right text-sm">
          ${price.toFixed(2)}
        </div>
      )
    },
  },
  {
    accessorFn: (row) => {
      if (!row.previous_price) return 0
      return row.current_price - row.previous_price
    },
    id: "change",
    header: "Change",
    cell: ({ row }) => {
      const change = row.getValue("change") as number
      const color = change > 0 ? "text-[#10B981]" : change < 0 ? "text-[#EF4444]" : "text-[#7588A3]"
      return (
        <div className={`text-right text-sm ${color}`}>
          {change > 0 ? "+" : ""}{change.toFixed(2)}
        </div>
      )
    },
  },
  {
    accessorFn: (row) => {
      if (!row.previous_price) return 0
      return ((row.current_price - row.previous_price) / row.previous_price) * 100
    },
    id: "changePercent",
    header: "Change%",
    cell: ({ row }) => {
      const pct = row.getValue("changePercent") as number
      const color = pct > 0 ? "text-[#10B981]" : pct < 0 ? "text-[#EF4444]" : "text-[#7588A3]"
      return (
        <div className={`text-right text-sm ${color}`}>
          {pct > 0 ? "+" : ""}{pct.toFixed(2)}%
        </div>
      )
    },
  },
  {
    accessorKey: "Previous_Rating",
    header: "Previous Rating",
    enableSorting: false,
    cell: ({ row }) => {
      const rating = row.getValue("Previous_Rating") as string
      return (
        <div className="flex justify-center">
          <div
            className={`w-[91px] h-[20px] ${getRatingColor(rating)} text-[#F8FAFC] rounded-[16px] flex items-center justify-center text-xs font-semibold`}
          >
            {rating || "N/A"}
          </div>
        </div>
      )
    },
  },
  {
    id: "arrow",
    enableSorting: false,
    cell: () => (
      <div className="flex justify-center">
        <LongArrowRight className="text-[#F8FAFC]" />
      </div>
    ),
  },
  {
    accessorKey: "Technical_Rating",
    header: "Current Rating",
    enableSorting: false,
    cell: ({ row }) => {
      const rating = row.getValue("Technical_Rating") as string
      return (
        <div className="flex justify-center">
          <div
            className={`w-[91px] h-[20px] ${getRatingColor(rating)} text-[#F8FAFC] rounded-[16px] flex items-center justify-center text-xs font-semibold`}
          >
            {rating}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "fetched_date",
    header: "Date",
    cell: ({ row }) => {
      const dateString = row.getValue("fetched_date") as string
      if (!dateString) return <div className="text-[#7588A3] text-center text-sm">-</div>

      let displayDate = dateString
      // Assuming dateString is "YYYY-MM-DD" or similar
      const date = parseISO(dateString)
      
      if (!isNaN(date.getTime())) {
        if (isToday(date)) {
          displayDate = "Today"
        } else if (isYesterday(date)) {
          displayDate = "Yesterday"
        } else {
          displayDate = format(date, "MMM dd")
        }
      }

      return (
        <div className="text-[#7588A3] text-center text-sm">
          {displayDate}
        </div>
      )
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      return (
        <div className="text-right">
          <Link
            to={`/symbols/${encodeURIComponent(row.original.symbol)}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1E293B] hover:bg-[#10B981] text-[#F8FAFC] text-xs font-semibold transition-all duration-200 group"
          >
            View Details
            <LongArrowRight className="ml-2 w-4 h-4 text-[#7588A3] group-hover:text-white transition-colors" />
          </Link>
        </div>
      )
    },
  },
]
