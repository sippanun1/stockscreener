import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { QueryFunctionContext, UseQueryResult } from "@tanstack/react-query";
import type { Stock } from "@/types/stock";

export interface Filters {
  market?: string;
  currentRating?: string;
  technicalRating?: string;
  previousRating?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  sectorsSelected?: string[];
  favoritesOnly?: boolean;
  breakoutScores?: string[];
  limit?: string;
}

export interface StockApiResponse {
  data: Stock[];
  count: number;
  total: number;
}

export interface FetchStocksResult {
  stocks: Stock[];
  total: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Define the shape of our query keys for strict typing
type QueryKey = readonly ["stocks", Filters];

// Extracted API fetching logic with strict types
export const fetchStocks = async ({ queryKey }: QueryFunctionContext<QueryKey>): Promise<FetchStocksResult> => {
  const [, currentFilters] = queryKey;
  
  const params = new URLSearchParams();
  const limit = currentFilters?.limit || '100';
  params.append('limit', limit);
  
  if (currentFilters?.market && currentFilters.market.toLowerCase() !== 'all' && currentFilters.market !== '') {
    params.append('market', currentFilters.market);
  }

  if (currentFilters?.search && currentFilters.search.trim() !== '') {
    params.append('search', currentFilters.search);
  }

  if (currentFilters?.currentRating) {
    params.append('rating', currentFilters.currentRating);
  }

  if (currentFilters?.technicalRating) {
    params.append('technical_rating', currentFilters.technicalRating);
  }

  if (currentFilters?.sectorsSelected && currentFilters.sectorsSelected.length > 0) {
    params.append('sectors', currentFilters.sectorsSelected.join(','));
  }

  if (currentFilters?.previousRating && currentFilters.previousRating !== '') {
    params.append('previous_rating', currentFilters.previousRating);
  }

  if (currentFilters?.breakoutScores && currentFilters.breakoutScores.length > 0) {
    params.append('breakout_scores', currentFilters.breakoutScores.join(','));
  }

  if (currentFilters?.sortBy) {
    if (currentFilters.sortBy === 'top_gainers') {
      params.append('sort_by', 'changePercent');
      params.append('sort_order', 'desc');
    } else if (currentFilters.sortBy === 'top_accuracy') {
      params.append('sort_by', 'accuracy_percent');
      params.append('sort_order', 'desc');
    } else {
      params.append('sort_by', currentFilters.sortBy);
      if (currentFilters.sortOrder) {
        params.append('sort_order', currentFilters.sortOrder);
      } else {
        params.append('sort_order', 'desc');
      }
    }
  }

  const response = await fetch(`${API_URL}/api/stocks?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const data: StockApiResponse = await response.json();
  
  // Apply Favorites Filter on the client-side as it relies on localStorage
  let processedStocks = data.data;
  if (currentFilters?.favoritesOnly) {
    const favoritesStr = localStorage.getItem('favorites');
    if (favoritesStr) {
      const favorites: string[] = JSON.parse(favoritesStr);
      processedStocks = processedStocks.filter(stock => favorites.includes(stock.symbol));
    } else {
      processedStocks = [];
    }
  }

  return {
    stocks: processedStocks,
    total: data.total
  };
};

/**
 * Custom React Query hook to manage fetching and caching of stocks list.
 */
export function useStocksQuery(filters: Filters): UseQueryResult<FetchStocksResult, Error> {
  return useQuery({
    queryKey: ['stocks', filters] as const,
    queryFn: fetchStocks,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
  });
}
