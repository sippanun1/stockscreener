export type Stock = {
  market: string;
  symbol: string;
  name: string;
  current_price: number;
  previous_price?: number;
  Technical_Rating: string;
  Previous_Rating?: string;       // Last different rating
  previous_rating_date?: string;  // When the rating last changed
  fetched_date?: string;
  backtest_acc_5d?: number;
};
