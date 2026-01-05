import AnalyticsStats from "./AnalyticsStats";
import WinRateChart from "./WinRateChart";
import HistoricalWinRate from "./HistoricalWinRate";
import { analyticsData } from "../api/analyticsData";

export default function AnalyticsPage() {
  return (
    <div className="pb-10">
      <AnalyticsStats
        totalSignals={analyticsData.totalSignalsMonth}
        avgWinRate={analyticsData.averageWinRate}
        bestMarket={analyticsData.bestPerformingMarket}
      />
      <WinRateChart data={analyticsData.winRateTrend} />
      <HistoricalWinRate data={analyticsData.historicalWinRate} />
    </div>
  );
}
