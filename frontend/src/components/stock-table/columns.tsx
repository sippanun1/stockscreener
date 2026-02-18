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
    case "IN":
      return "INR"
    case "VN":
      return "VND"
    case "UK":
      return "GBX"
    default:
      return "USD"
  }
}

export const stockColumns: ColumnDef<Stock>[] = [
  {
    accessorKey: "symbol",
    header: "Symbol",
    sortDescFirst: false, // ↑ = 0→A→Z, ↓ = Z→A→0
    size: 240,
    minSize: 200,
    maxSize: 350,
    cell: ({ row }) => {
      const symbol = row.getValue("symbol") as string
      // Extract clean symbol for display (e.g. "NVDA")
      const displaySymbol = symbol.split(":")[1] || symbol
      return (
        <div className="flex items-center gap-2.5 sm:gap-4 pl-1">
          <StockLogo symbol={symbol} name={row.original.name} className="w-6 h-6 sm:w-8 sm:h-8 text-[11px] sm:text-xs shrink-0 rounded-full border border-[#7588A3]/10" />
          <div className="flex flex-col min-w-0 leading-tight">
             <div className="text-[#FFFFFF] font-bold text-sm sm:text-[15px] truncate">
                {displaySymbol}
             </div>
             <span className="text-[#7588A3] text-[11px] sm:text-[12px] font-medium truncate mt-0.5 max-w-[130px] sm:max-w-[160px]" title={row.original.name}>
                {row.original.name}
             </span>
          </div>
        </div>
      )
    },
  },
  {
    accessorFn: (row) => row.symbol.split(":")[0],
    id: "exchange",
    header: "Exchange",
    sortDescFirst: false, // ↑ = A→Z, ↓ = Z→A
    size: 60,
    minSize: 50,
    maxSize: 75,
    cell: ({ row }) => {
      const symbol = row.original.symbol
      return (
        <div className="text-[#F8FAFC] text-left text-xs sm:text-sm">
          {symbol.split(":")[0]}
        </div>
      )
    },
  },
  {
    accessorKey: "current_price",
    header: "Price",
    size: 95,
    minSize: 80,
    maxSize: 120,
    cell: ({ row }) => {
      const price = parseFloat(row.getValue("current_price"))
      const market = row.original.market
      return (
        <div className="text-right text-xs sm:text-sm">
          <span className="text-[#F8FAFC]">{price.toLocaleString()}</span>
          <span className="text-[#F8FAFC] text-[10px] sm:text-[0.65rem] ml-0.5 sm:ml-1">{getCurrencySymbol(market)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "sector",
    header: "Sector",
    size: 120,
    minSize: 90,
    maxSize: 180,
    sortDescFirst: false, // ↑ = A→Z, ↓ = Z→A
    cell: ({ row }) => {
      const sector = row.getValue("sector") as string
      return (
        <div className="text-left text-xs sm:text-sm text-[#F8FAFC] truncate" title={sector}>
          {sector || "-"}
        </div>
      )
    },
  },


  {
    accessorKey: "change",
    id: "change",
    header: "Change",
    size: 95,
    minSize: 80,
    maxSize: 120,
    cell: ({ row }) => {
      const change = row.getValue("change") as number
      const color = change > 0 ? "text-[#00FFB7]" : change < 0 ? "text-[#FF3069]" : "text-[#7588A3]"
      return (
        <div className={`text-right text-xs sm:text-sm ${color}`}>
          {change > 0 ? "+" : ""}{change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="text-[#F8FAFC] text-[10px] sm:text-[0.65rem] ml-0.5 sm:ml-1">{getCurrencySymbol(row.original.market)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "changePercent",
    id: "changePercent",
    header: "Change%",
    size: 85,
    minSize: 70,
    maxSize: 110,
    cell: ({ row }) => {
      const pct = row.getValue("changePercent") as number
      const color = pct > 0 ? "text-[#00FFB7]" : pct < 0 ? "text-[#FF3069]" : "text-[#7588A3]"
      return (
        <div className={`text-right text-xs sm:text-sm ${color}`}>
          {pct > 0 ? "+" : ""}{pct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
        </div>
      )
    },
  },
  {
    accessorKey: "accuracy_percent",
    header: "Accuracy",
    size: 70,
    minSize: 60,
    maxSize: 90,
    cell: ({ row }) => {
      const accuracy = row.original.accuracy_percent
      
      let color = "text-[#7588A3]"
      if (accuracy !== undefined && accuracy !== null) {
          if (accuracy >= 50) color = "text-[#00FFB7]" // Green (Matches Change%)
          else if (accuracy > 0) color = "text-[#FF3069]" // Red (Matches Change%)
      }
      
      return (
        <div className={`text-right text-xs sm:text-sm ${color}`}>
          {accuracy !== undefined && accuracy !== null ? `${accuracy.toFixed(0)}%` : "-"}
        </div>
      )
    },
  },
  {
    accessorKey: "Previous_Rating",
    header: "Previous Rating",
    size: 100,
    minSize: 80,
    maxSize: 120,
    enableSorting: false, // User requested disable
    cell: ({ row }) => {
      const previousRating = row.getValue("Previous_Rating") as string
      const currentRating = row.getValue("Technical_Rating") as string
      
      // Hide if Previous and Current are the same (no actual rating change)
      if (previousRating && previousRating !== "N/A" && previousRating !== "" && previousRating === currentRating) {
        return (
          <div className="text-[#7588A3] text-center text-sm">
            -
          </div>
        )
      }
      
      const displayRating = (!previousRating || previousRating === "N/A" || previousRating === "") 
        ? "N/A" 
        : previousRating

      return (
        <div className="flex justify-center">
          <div
            className={`w-[80px] sm:w-[100px] h-[22px] sm:h-[24px] ${displayRating === "N/A" ? "text-[#7588A3]" : getRatingStyles(displayRating)} rounded-[16px] flex items-center justify-center text-xs sm:text-sm font-semibold`}
          >
            {displayRating}
          </div>
        </div>
      )
    },
  },
  {
    id: "arrow",
    size: 40,
    minSize: 30,
    maxSize: 50,
    enableSorting: false,
    cell: () => {
      // Always show arrow as requested
      return (
        <div className="flex items-center justify-center">
          <LongArrowRight className="text-[#F8FAFC]" />
        </div>
      )
    },
  },
  {
    accessorKey: "Technical_Rating",
    header: "Current Rating",
    size: 100,
    minSize: 80,
    maxSize: 120,
    enableSorting: false, // User requested disable
    cell: ({ row }) => {
      const rating = row.getValue("Technical_Rating") as string
      return (
        <div className="flex justify-center">
          <div
            className={`w-[80px] sm:w-[100px] h-[22px] sm:h-[24px] ${getRatingStyles(rating)} rounded-[16px] flex items-center justify-center text-xs sm:text-sm font-semibold`}
          >
            {rating}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "rating_change_date",
    header: "Date",
    size: 100,
    minSize: 80,
    maxSize: 120,
    cell: ({ row }) => {
      // Show rating_change_date (when the rating changed to current status)
      const dateString = row.original.rating_change_date as string
      
      if (!dateString) return <div className="text-[#7588A3] text-center text-sm">-</div>

      let displayDate = dateString
      // Try to parse both simple date (YYYY-MM-DD) and ISO string
      try {
        const date = parseISO(dateString)
        
        if (!isNaN(date.getTime())) {
          // Always show actual date format (MMM dd, yyyy)
          displayDate = format(date, "MMM dd, yyyy")
        }
      } catch {
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
    size: 120,
    minSize: 100,
    maxSize: 150,
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
