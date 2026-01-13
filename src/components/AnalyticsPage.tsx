import { useEffect, useState } from "react";
import AnalyticsStats from "./AnalyticsStats";
import WinRateChart from "./WinRateChart";
import HistoricalWinRate from "./HistoricalWinRate";
import { fetchAnalyticsData, type AnalyticsDataType } from "../api/analyticsData";

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDataType | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const data = await fetchAnalyticsData();
        setAnalyticsData(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load analytics data"
        );
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="pb-10 px-[53px] pt-6">
        <p className="text-[#F8FAFC]">Loading analytics data...</p>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="pb-10 px-[53px] pt-6">
        <p className="text-[#CE0F44]">
          Error loading analytics: {error || "No data available"}
        </p>
        <p className="text-[#7588A3] text-sm mt-2">
          Make sure the API server is running at http://localhost:8000
        </p>
      </div>
    );
  }

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
