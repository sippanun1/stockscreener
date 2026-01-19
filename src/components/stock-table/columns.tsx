"use client"
import { format, parseISO } from "date-fns"
import { Link } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import type { Stock } from "@/types/stock"
import { StockLogo } from "@/components/StockLogo"
import { LongArrowRight } from "@/components/LongArrowRight"

const getRatingTextColor = (rating: string | undefined) => {
  if (!rating) return "text-[#7588A3]"
  switch (rating) {
    case "Strong Buy":
      return "text-[#00FFB7]"
    case "Buy":
      return "text-[#00FFB7]"
    case "Neutral":
      return "text-[#FFFFFF]"
    case "Sell":
      return "text-[#FF3069]"
    case "Strong Sell":
      return "text-[#FF3069]"
    default:
      return "text-[#7588A3]"
  }
}

const getRatingStyles = (rating: string | undefined) => {
  if (rating === "Strong Buy") {
    return "bg-[#07FFB91A] text-[#00FFB7]"
  }
  return getRatingTextColor(rating)
}

export const getCurrencySymbol = (market: string | undefined) => {
  switch (market?.toUpperCase()) {
    case "TH":
      return "THB"
    case "HK":
      return "HKD"
    case "JP":
      return "JPY"
    case "US":
      return "USD"
    default:
      return "USD"
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
        <div className="text-[#F8FAFC] text-left text-sm">
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
      const market = row.original.market
      return (
        <div className="text-right text-sm">
          <span className="text-[#F8FAFC]">{price}</span>
          <span className="text-[#F8FAFC] text-[0.65rem] ml-1">{getCurrencySymbol(market)}</span>
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
      const color = change > 0 ? "text-[#00FFB7]" : change < 0 ? "text-[#FF3069]" : "text-[#7588A3]"
      return (
        <div className={`text-right text-sm ${color}`}>
          {change > 0 ? "+" : ""}{change.toFixed(2)}
        </div>
      )
    },
  },
  {
    accessorFn: (row) => {
      if (!row.previous_price || row.previous_price === 0) return 0
      return ((row.current_price - row.previous_price) / row.previous_price) * 100
    },
    id: "changePercent",
    header: "Change%",
    cell: ({ row }) => {
      const pct = row.getValue("changePercent") as number
      const color = pct > 0 ? "text-[#00FFB7]" : pct < 0 ? "text-[#FF3069]" : "text-[#7588A3]"
      return (
        <div className={`text-right text-sm ${color}`}>
          {pct > 0 ? "+" : ""}{pct.toFixed(2)}%
        </div>
      )
    },
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
            className={`w-[100px] h-[24px] ${getRatingStyles(rating)} rounded-[16px] flex items-center justify-center text-sm font-semibold`}
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
      // Use rating_change_date if available (signal start date), otherwise fetched_date
      const dateString = (row.original.rating_change_date || row.getValue("fetched_date")) as string
      
      if (!dateString) return <div className="text-[#F8FAFC] text-center text-sm">-</div>

      let displayDate = dateString
      // Try to parse both simple date (YYYY-MM-DD) and ISO string
      try {
        const date = parseISO(dateString)
        
        if (!isNaN(date.getTime())) {
          // Always show actual date format
          displayDate = format(date, "MMM dd")
        }
      } catch (e) {
        // Fallback to original string if parse fails
      }

      return (
        <div className="text-[#F8FAFC] text-center text-sm">
          {displayDate}
        </div>
      )
    },
  },
  {
    id: "actions",
    header: "History",
    cell: ({ row }) => {
      return (
        <div className="flex justify-center">
          <Link
            to={`/symbols/${encodeURIComponent(row.original.symbol)}`}
            className="relative inline-flex items-center justify-center w-[110px] h-[28px] rounded-full bg-[#1E40AF] hover:bg-[#1E3A8A] text-[#F8FAFC] text-xs font-semibold transition-all duration-200 group overflow-hidden"
          >
            <span className="group-hover:-translate-x-2 transition-transform duration-200">View Details</span>
            <LongArrowRight className="absolute right-3 w-4 h-4 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </Link>
        </div>
      )
    },
  },
]

