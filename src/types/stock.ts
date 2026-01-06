export type Stock = {
  market: string;
  symbol: string;
  name: string;
  current_price: number;
  previous_price?: number;
  yesterday_price?: number;
  Technical_Rating: string;
  Yesterday_Rating?: string;
  history?: Array<{
    Technical_Rating: string;
    fetched_at: string;
    fetched_at_epoch: number;
  }>;
};
