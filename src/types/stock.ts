export type Stock = {
  market: string;
  symbol: string;
  name: string;
  current_price: number;
  previous_price?: number;
  Technical_Rating: string;
  Yesterday_Rating?: string;
};
