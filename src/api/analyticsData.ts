const API_URL = "http://localhost:8000";

export interface Signal {
  date: string;
  rating: string;
  previousRating: string;
  market: string;
}

export interface WinRateTrendData {
  date: string;
  winRate: number;
  signalCount: number;
}

export interface HistoricalWinRateData {
  signal: string;
  winRate: number;
  color: string;
  count: number;
}

export interface AnalyticsDataType {
  totalSignalsMonth: number;
  averageWinRate: number;
  bestPerformingMarket: {
    name: string;
    winRate: number;
  };
  winRateTrend: WinRateTrendData[];
  historicalWinRate: HistoricalWinRateData[];
}

// Helper function to calculate signals from stock data
function calculateSignals(
  stocks: Array<{
    symbol: string;
    market: string;
    Technical_Rating: string;
    Previous_Rating: string;
    previous_rating_date?: string;
    fetched_date?: string;
  }>
): Signal[] {
  return stocks
    .filter((stock) => stock.Previous_Rating) // Only stocks with rating changes
    .map((stock) => ({
      date: stock.fetched_date || new Date().toISOString().split("T")[0],
      rating: stock.Technical_Rating,
      previousRating: stock.Previous_Rating,
      market: stock.market,
    }));
}

// Helper to format date as "Jan 12" or "Jan 12" style
function formatDateForChart(dateString: string): string {
  try {
    const date = new Date(dateString);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    return `${month} ${day}`;
  } catch {
    return dateString;
  }
}

// Helper to group signals by date
function groupSignalsByDate(
  signals: Signal[]
): Map<string, Signal[]> {
  const grouped = new Map<string, Signal[]>();
  signals.forEach((signal) => {
    if (!grouped.has(signal.date)) {
      grouped.set(signal.date, []);
    }
    grouped.get(signal.date)!.push(signal);
  });
  return grouped;
}

// Main function to fetch analytics data from database
export async function fetchAnalyticsData(): Promise<AnalyticsDataType> {
  try {
    // First, check what dates are available
    console.log("Checking available dates in database...");
    const datesResponse = await fetch(`${API_URL}/api/dates`);
    const datesData = await datesResponse.json();
    const availableDates = datesData.dates || [];
    console.log("Available dates in database:", availableDates);
    
    // Fetch all signal changes
    console.log("Fetching analytics data from:", `${API_URL}/api/signal-changes?limit=50000`);
    const response = await fetch(
      `${API_URL}/api/signal-changes?limit=50000`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const stocks = result.data || [];
    console.log("Fetched stocks with signal changes:", stocks.length);

    // Calculate signals
    const signals = calculateSignals(stocks);
    console.log("Calculated signals:", signals.length);
    console.log("Sample signal dates:", signals.slice(0, 5).map(s => s.date));
    console.log("Unique dates in signals:", [...new Set(signals.map(s => s.date))]);
    
    const uniqueDates = [...new Set(signals.map(s => s.date))];
    const hasMultipleDates = uniqueDates.length > 1;
    console.log(`Has multiple dates: ${hasMultipleDates} (${uniqueDates.length} unique dates)`);

    // Calculate total signals this month
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
    const signalsThisMonth = signals.filter((s) => {
      const signalDate = new Date(s.date);
      return signalDate >= monthAgo && signalDate <= now;
    });

    const totalSignalsMonth = signalsThisMonth.length;

    // Calculate average win rate across all signals
    const sellSignals = signals.filter(
      (s) => s.rating === "Sell" || s.rating === "Strong Sell"
    ).length;
    const totalSignals = signals.length;
    const averageWinRate =
      totalSignals > 0
        ? Math.round(((totalSignals - sellSignals) / totalSignals) * 100)
        : 0;

    // Calculate win rate trend by date
    const groupedSignals = groupSignalsByDate(signals);
    let winRateTrend: WinRateTrendData[] = [];
    
    if (hasMultipleDates && uniqueDates.length >= 2) {
      // Multiple dates: group by date
      winRateTrend = Array.from(groupedSignals.entries())
        .map(([date, daySignals]) => {
          const wins = daySignals.filter((s) =>
            ["Buy", "Strong Buy"].includes(s.rating)
          ).length;
          return {
            date: formatDateForChart(date),
            winRate: Math.round((wins / daySignals.length) * 100),
            signalCount: daySignals.length,
          };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30); // Last 30 dates
      console.log("Multiple dates detected. Win rate trend by date:", winRateTrend.length);
    } else {
      // Single date or limited data: group by market instead
      const marketTrend = new Map<string, WinRateTrendData>();
      signals.forEach((signal) => {
        if (!marketTrend.has(signal.market)) {
          marketTrend.set(signal.market, {
            date: signal.market,
            winRate: 0,
            signalCount: 0,
          });
        }
        const trend = marketTrend.get(signal.market)!;
        trend.signalCount++;
        if (["Buy", "Strong Buy"].includes(signal.rating)) {
          trend.winRate++;
        }
      });
      
      winRateTrend = Array.from(marketTrend.values()).map((item) => ({
        date: item.date,
        winRate: Math.round((item.winRate / item.signalCount) * 100),
        signalCount: item.signalCount,
      }));
      console.log("Single date detected. Showing win rate trend by market:", winRateTrend);
    }

    // Calculate historical win rate by rating type
    const historicalWinRate = [
      { rating: "Strong Buy", color: "#065F46" },
      { rating: "Buy", color: "#007957" },
      { rating: "Neutral", color: "#6B7280" },
      { rating: "Sell", color: "#CE0F44" },
      { rating: "Strong Sell", color: "#A10F38" },
    ].map((item) => {
      const ratingSignals = signals.filter((s) => s.rating === item.rating);
      const wins = ratingSignals.filter((s) =>
        ["Buy", "Strong Buy"].includes(s.rating)
      ).length;
      const winRate =
        ratingSignals.length > 0
          ? Math.round((wins / ratingSignals.length) * 100)
          : 0;

      console.log(`${item.rating}: ${ratingSignals.length} signals, ${winRate}% win rate`);

      return {
        signal: item.rating,
        winRate,
        color: item.color,
        count: ratingSignals.length,
      };
    });

    // Calculate best performing market (highest % of Buy + Strong Buy)
    const marketStats = new Map<
      string,
      { buy: number; strongBuy: number; total: number }
    >();

    signals.forEach((signal) => {
      if (!marketStats.has(signal.market)) {
        marketStats.set(signal.market, {
          buy: 0,
          strongBuy: 0,
          total: 0,
        });
      }
      const stats = marketStats.get(signal.market)!;
      stats.total++;
      if (signal.rating === "Buy") stats.buy++;
      if (signal.rating === "Strong Buy") stats.strongBuy++;
    });

    let bestPerformingMarket = { name: "US", winRate: 0 };
    marketStats.forEach((stats, market) => {
      const winPercentage = Math.round(
        (((stats.buy + stats.strongBuy) / stats.total) * 100)
      );
      if (winPercentage > bestPerformingMarket.winRate) {
        bestPerformingMarket = { name: market, winRate: winPercentage };
      }
    });

    return {
      totalSignalsMonth,
      averageWinRate,
      bestPerformingMarket,
      winRateTrend,
      historicalWinRate,
    };
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    // Return default empty data on error
    return {
      totalSignalsMonth: 0,
      averageWinRate: 0,
      bestPerformingMarket: { name: "N/A", winRate: 0 },
      winRateTrend: [],
      historicalWinRate: [],
    };
  }
}
