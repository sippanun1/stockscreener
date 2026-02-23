export type Stock = {
  market: string;
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
  current_price: number;
  previous_price?: number;
  yesterday_price?: number;
  change?: number;                // Absolute price change
  changePercent?: number;         // Percentage change
  exchange?: string;              // Exchange code (e.g., BSE, NSE)
  Technical_Rating: string;
  Previous_Rating?: string;       // Last different rating
  previous_rating_date?: string;  // When the rating last changed (end of previous rating)
  rating_change_date?: string;    // Start of current rating
  fetched_date?: string;
  backtest_acc_5d?: number;
  accuracy_percent?: number; // Total accuracy from all signals
  total_signals?: number;    // Total number of signals computed
  Yesterday_Rating?: string;
  history?: Array<{
    Technical_Rating: string;
    fetched_at: string;
    fetched_at_epoch: number;
  }>;
};
