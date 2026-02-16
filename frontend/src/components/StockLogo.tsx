import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface StockLogoProps {
  symbol: string
  name: string
  className?: string
}

// Logo sources configuration
const getLogoUrl = (source: 'logokit' | 'elbstream', symbol: string) => {
  // Extract ticker and exchange from symbol (e.g. "NASDAQ:NVDA" -> ticker: "NVDA", exchange: "NASDAQ")
  const parts = symbol.split(':')
  const ticker = parts[1] || symbol
  const exchange = parts[0]
  
  let formattedTicker = ticker
  
  // Format ticker based on exchange
  if (exchange === 'HKEX') {
    formattedTicker = `${ticker}.HK`
  }
  else if (exchange === 'TSE' || exchange === 'SAPSE') {
    formattedTicker = `${ticker}.T`
  }
  else if (exchange === 'SET') {
    formattedTicker = `${ticker}.BK`
  }
  else if (exchange === 'BSE') {
      formattedTicker = `${ticker}.BO`
  }
  else if (exchange === 'NSE') {
      formattedTicker = `${ticker}.NS`
  }
  else if (exchange === 'LSE') {
      formattedTicker = `${ticker}.L`
  }
  else if (exchange === 'VNI') { 
      formattedTicker = `${ticker}.vn` // Vietnamese stocks often use just symbol or .vn
  }
  
  if (source === 'logokit') {
    // LogoKit implementation
    // Using 48px to look good on retina 24px/32px
    return `https://img.logokit.com/ticker/${formattedTicker}?size=64`
  } else {
    // Elbstream implementation (Existing)
    return `https://api.elbstream.com/logos/symbol/${formattedTicker}?size=64&format=png`
  }
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
  const [sourceIndex, setSourceIndex] = useState(0) // 0: logokit, 1: elbstream, 2: fallback
  const sources: ('logokit' | 'elbstream')[] = ['logokit', 'elbstream']

  // Reset state when symbol changes
  useEffect(() => {
    setSourceIndex(0)
  }, [symbol])

  const handleError = () => {
    setSourceIndex((prev) => prev + 1)
  }

  // Fallback (Initials)
  if (sourceIndex >= sources.length) {
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

  // Image Logo
  return (
    <img
      src={getLogoUrl(sources[sourceIndex], symbol)}
      alt={name}
      className={cn("w-8 h-8 rounded-full object-cover bg-white shrink-0", className)}
      onError={handleError}
      loading="lazy"
    />
  )
}
