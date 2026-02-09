import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface StockLogoProps {
  symbol: string
  name: string
  className?: string
}

const getStockLogoUrl = (symbol: string) => {
  // Extract ticker and exchange from symbol (e.g. "NASDAQ:NVDA" -> ticker: "NVDA", exchange: "NASDAQ")
  const parts = symbol.split(':')
  const ticker = parts[1] || symbol
  const exchange = parts[0]
  
  // Format ticker based on exchange for Elbstream API
  let formattedTicker = ticker
  
  // Hong Kong stocks: add .HK suffix
  if (exchange === 'HKEX') {
    formattedTicker = `${ticker}.HK`
  }
  // Tokyo stocks: add .T suffix
  else if (exchange === 'TSE' || exchange === 'SAPSE') {
    formattedTicker = `${ticker}.T`
  }
  // Bangkok/Thailand stocks: add .BK suffix
  else if (exchange === 'SET') {
    formattedTicker = `${ticker}.BK`
  }
  // US stocks: use ticker as-is (AAPL, TSLA, etc.)
  
  // Elbstream Logo API - correct endpoint format
  return `https://api.elbstream.com/logos/symbol/${formattedTicker}?size=64&format=png`
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
    // Use full ticker symbol (e.g. "AJA") instead of initials
    const parts = symbol.split(':')
    const ticker = parts[1] || symbol
    // Display first 3 characters maximum as requested
    const initials = ticker.substring(0, 3).toUpperCase()
    
    // Scale font size based on length
    let fontSize = "text-[10px]"
    if (initials.length >= 3) fontSize = "text-[10px]"

    return (
      <div 
        className={cn(
          `w-8 h-8 rounded-full flex items-center justify-center ${fontSize} font-bold text-white shadow-sm shrink-0`,
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
