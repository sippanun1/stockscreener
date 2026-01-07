import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface StockLogoProps {
  symbol: string
  name: string
  className?: string
}

const getStockLogoUrl = (symbol: string) => {
  // Clean symbol (e.g. "NASDAQ:NVDA" -> "NVDA") because FMP uses pure symbol
  const cleanSymbol = symbol.split(':')[1] || symbol
  return `https://financialmodelingprep.com/image-stock/${cleanSymbol}.png`
}

// Generate consistent pastel color based on name string
const getFallbackColor = (name: string) => {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-yellow-500",
    "bg-indigo-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-rose-500"
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export const StockLogo = ({ symbol, name, className }: StockLogoProps) => {
  const [error, setError] = useState(false)

  // Reset error state when symbol changes (important for virtualized tables)
  useEffect(() => {
    setError(false)
  }, [symbol])

  if (error) {
    const initials = (name || symbol)
      .substring(0, 2)
      .toUpperCase()
      .replace(/[^A-Z]/g, "") || symbol.substring(0, 1).toUpperCase()

    return (
      <div 
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0",
          getFallbackColor(name),
          className
        )}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={getStockLogoUrl(symbol)}
      alt={name}
      className={cn("w-8 h-8 rounded-full object-cover bg-white shrink-0", className)}
      onError={() => setError(true)}
      loading="lazy"
    />
  )
}
