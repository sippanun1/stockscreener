// Mock data for analytics
export const analyticsData = {
  totalSignalsMonth: 1247,
  averageWinRate: 67.2,
  marketAboveAverage: true,
  bestPerformingMarket: {
    name: "US",
    winRate: 72,
  },
  winRateTrend: [
    { date: "Oct 1", winRate: 59 },
    { date: "Oct 8", winRate: 62 },
    { date: "Oct 15", winRate: 65 },
    { date: "Oct 22", winRate: 64 },
    { date: "Oct 29", winRate: 66 },
    { date: "Nov 5", winRate: 65 },
    { date: "Nov 12", winRate: 68 },
    { date: "Nov 19", winRate: 72 },
    { date: "Nov 26", winRate: 73 },
    { date: "Dec 2", winRate: 71 },
  ],
  historicalWinRate: [
    { signal: "Strong Buy", winRate: 78, color: "#065F46" },
    { signal: "Buy", winRate: 68, color: "#007957" },
    { signal: "Neutral", winRate: 52, color: "#6B7280" },
    { signal: "Sell", winRate: 62, color: "#CE0F44" },
    { signal: "Strong Sell", winRate: 71, color: "#A10F38" },
  ],
};
