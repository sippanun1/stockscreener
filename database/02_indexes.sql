
-- 02_indexes.sql
-- =========================================================================================
-- STEP 2: Performance Optimization Indexes
-- =========================================================================================

-- Speed up history lookups (For V7+ performance architecture)
CREATE INDEX IF NOT EXISTS idx_stock_ratings_history_search 
ON public.stock_ratings (symbol, fetched_date DESC, fetched_time DESC);

-- Speed up market-specific queries and dashboard filtering
CREATE INDEX IF NOT EXISTS idx_stock_ratings_market_date 
ON public.stock_ratings (market, fetched_date DESC);

-- Speed up deduplication sorting (DISTINCT ON symbol)
CREATE INDEX IF NOT EXISTS idx_stock_ratings_symbol_lookup 
ON public.stock_ratings (symbol);

-- Optimize date-based signal change tracking
CREATE INDEX IF NOT EXISTS idx_stock_ratings_signal_date 
ON public.stock_ratings (rating_change_date DESC);

-- Optimize rating-based filtering for dashboard cards
CREATE INDEX IF NOT EXISTS idx_stock_ratings_technical_rating 
ON public.stock_ratings (technical_rating) 
WHERE technical_rating != 'Neutral';

-- Index for signal_returns lookups
CREATE INDEX IF NOT EXISTS idx_signal_returns_symbol_date 
ON public.signal_returns (symbol, entry_date);
