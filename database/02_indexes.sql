
-- 02_indexes.sql
-- =========================================================================================
-- STEP 2: Performance Optimization Indexes (Optimized V7.2)
-- =========================================================================================

-- 1. Optimize LATERAL Join Performance (Crucial for get_stocks_v3 timeout fix)
-- Replaces simple history search with a covering index for the lateral join
CREATE INDEX IF NOT EXISTS idx_stock_ratings_lateral_opt 
ON public.stock_ratings (symbol, fetched_date DESC, fetched_time DESC, technical_rating)
INCLUDE (current_price);

-- 2. Optimize Main Screener Filtering
-- Covers the most common filter combination: Market + Date + Rating
CREATE INDEX IF NOT EXISTS idx_stock_ratings_screener_cover 
ON public.stock_ratings (fetched_date DESC, market, technical_rating)
INCLUDE (symbol, name, current_price, technical_score, rating_change_date)
WHERE symbol NOT LIKE 'OTC:%';

-- 3. Speed up deduplication sorting (DISTINCT ON symbol)
CREATE INDEX IF NOT EXISTS idx_stock_ratings_symbol_lookup 
ON public.stock_ratings (symbol);

-- 4. Optimize date-based signal change tracking
CREATE INDEX IF NOT EXISTS idx_stock_ratings_signal_date 
ON public.stock_ratings (rating_change_date DESC);

-- 5. Optimize Search Performance (Text Search)
CREATE INDEX IF NOT EXISTS idx_stock_ratings_symbol_trgm 
ON public.stock_ratings (symbol text_pattern_ops);

-- 6. Index for signal_returns lookups
CREATE INDEX IF NOT EXISTS idx_signal_returns_symbol_date 
ON public.signal_returns (symbol, entry_date);

-- Note: Run VACUUM ANALYZE separate from transaction block
-- VACUUM ANALYZE public.stock_ratings;
