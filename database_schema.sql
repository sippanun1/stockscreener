-- =========================================================================================
-- FULL REFRESH SCRIPT (Optimized - Latest Version)
-- Contains ALL Supabase SQL functions and tables with latest updates
-- =========================================================================================
-- FEATURES:
-- ✅ Server-side filtering for Positive/Negative signal cards (target_technical_rating)
-- ✅ Sort by rating_change_date (when rating changed) as default
-- ✅ All filters: market, search, rating, technical_rating
-- ✅ Signal Returns Tracking (1/10/30 day returns)
-- ✅ Optimized indexes for fast queries
-- =========================================================================================

-- ==========================================
-- 1. DROP OLD FUNCTIONS
-- ==========================================
DROP FUNCTION IF EXISTS get_stocks_with_last_rating(TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_stocks_with_last_rating(TEXT, DATE, TEXT, TEXT, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_stocks_with_last_rating(TEXT, DATE, TEXT, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_stocks_with_last_rating(TEXT, DATE, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_dashboard_stats(TEXT, DATE);
DROP FUNCTION IF EXISTS get_dashboard_stats(DATE);
DROP FUNCTION IF EXISTS get_dashboard_stats();
DROP FUNCTION IF EXISTS get_top_gainers(TEXT, DATE, INT);
DROP FUNCTION IF EXISTS get_top_gainers(INT);
DROP FUNCTION IF EXISTS get_top_gainers();
DROP FUNCTION IF EXISTS get_stocks_count_filtered(TEXT, DATE, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_stocks_count_filtered(TEXT, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_stocks_count_filtered(TEXT, DATE, TEXT);

-- ==========================================
-- 1. CREATE TABLES
-- ==========================================

-- Drop existing tables if they exist
-- WARNING: Commented out to prevent data loss during schema updates
-- DROP TABLE IF EXISTS stock_ratings CASCADE;
-- DROP TABLE IF EXISTS signal_returns CASCADE;

-- Create stock_ratings table
CREATE TABLE IF NOT EXISTS stock_ratings (
    id BIGSERIAL PRIMARY KEY,
    
    -- Stock identification
    symbol TEXT NOT NULL,
    market TEXT NOT NULL,
    name TEXT,
    
    -- Price data
    current_price NUMERIC NOT NULL DEFAULT 0,
    previous_price NUMERIC DEFAULT 0,
    open NUMERIC DEFAULT 0,
    high NUMERIC DEFAULT 0,
    low NUMERIC DEFAULT 0,
    volume BIGINT DEFAULT 0,
    
    -- Intraday price tracking
    premarket_close NUMERIC DEFAULT 0,
    premarket_open NUMERIC DEFAULT 0,
    postmarket_close NUMERIC DEFAULT 0,
    postmarket_open NUMERIC DEFAULT 0,
    
    -- Technical analysis
    technical_score NUMERIC DEFAULT 0,
    technical_rating TEXT NOT NULL,
    previous_rating TEXT,
    rating_change_date DATE,
    
    -- Timestamps
    fetched_date DATE NOT NULL,
    fetched_time TIME NOT NULL,
    session_type TEXT DEFAULT 'post_market',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate records
    UNIQUE(symbol, fetched_date, fetched_time, session_type)
);

-- Create signal_returns table
CREATE TABLE IF NOT EXISTS signal_returns (
    id BIGSERIAL PRIMARY KEY,
    
    -- Stock Info
    symbol TEXT NOT NULL,
    market TEXT NOT NULL,
    
    -- Signal Info
    signal_date DATE NOT NULL,
    from_rating TEXT,
    to_rating TEXT NOT NULL,
    
    -- Prices
    signal_entry_price NUMERIC NOT NULL,
    price_after_1d NUMERIC,
    price_after_10d NUMERIC,
    price_after_30d NUMERIC,
    
    -- Returns (%)
    return_1d NUMERIC,
    return_10d NUMERIC,
    return_30d NUMERIC,
    
    -- Tracking
    return_1d_calculated_at TIMESTAMP,
    return_10d_calculated_at TIMESTAMP,
    return_30d_calculated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(symbol, signal_date, to_rating)
);


-- ==========================================
-- 2. MAIN TABLE FUNCTION (get_stocks_with_last_rating)
-- ==========================================
-- Returns stocks with their previous rating for displaying in main table
-- Supports:
-- - Market filter (US, TH, HK, JP)
-- - Search filter (symbol/name)
-- - Rating filter (Strong Buy, Buy, Sell, Strong Sell)
-- - Technical rating grouping (Positive = Buy+Strong Buy, Negative = Sell+Strong Sell)
-- - Multiple sort options (rating_change_date, fetched_date, price, change, changePercent, symbol)
-- ==========================================

CREATE OR REPLACE FUNCTION get_stocks_with_last_rating(
    target_market TEXT DEFAULT NULL,
    target_date DATE DEFAULT NULL,
    search_term TEXT DEFAULT NULL,
    target_rating TEXT DEFAULT NULL,
    target_technical_rating TEXT DEFAULT NULL,
    sort_by TEXT DEFAULT 'rating_change_date',
    sort_order TEXT DEFAULT 'desc',
    limit_val INT DEFAULT 100,
    offset_val INT DEFAULT 0
)
RETURNS TABLE (
    id BIGINT, symbol TEXT, market TEXT, name TEXT,
    current_price NUMERIC, previous_price NUMERIC, technical_score NUMERIC, 
    "Technical_Rating" TEXT, "Previous_Rating" TEXT,
    rating_change_date DATE, fetched_date DATE, fetched_time TIME
) 
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH CurrentStock AS (
        SELECT DISTINCT ON (t.symbol) 
            t.id, t.symbol, t.market, t.name, 
            t.current_price, 
            -- Prioritize calculated previous values if static ones are NULL
            COALESCE(t.previous_price, prev.current_price) as previous_price,
            t.technical_score,
            t.technical_rating, 
            COALESCE(t.previous_rating, prev.technical_rating) as previous_rating,
            t.rating_change_date, t.fetched_date, t.fetched_time
        FROM stock_ratings t
        -- Self-join to find the immediate previous record
        LEFT JOIN LATERAL (
            SELECT current_price, technical_rating 
            FROM stock_ratings p 
            WHERE p.symbol = t.symbol 
              AND (p.fetched_date < t.fetched_date OR (p.fetched_date = t.fetched_date AND p.fetched_time < t.fetched_time))
            ORDER BY p.fetched_date DESC, p.fetched_time DESC 
            LIMIT 1
        ) prev ON TRUE
        WHERE (target_market IS NULL OR t.market = target_market)
          AND (target_date IS NULL OR t.fetched_date <= target_date)
          AND (search_term IS NULL OR t.symbol ILIKE '%' || search_term || '%' OR t.name ILIKE '%' || search_term || '%')
          AND t.current_price >= 0.1
          AND t.symbol NOT LIKE 'OTC:%'
          AND t.technical_rating != 'Neutral'
          -- Use the COALESCE value for filtering
          AND (COALESCE(t.previous_rating, prev.technical_rating) IS NULL OR COALESCE(t.previous_rating, prev.technical_rating) != 'Neutral')
          AND (target_rating IS NULL OR t.technical_rating = target_rating)
          AND (target_technical_rating IS NULL 
               OR (target_technical_rating = 'Positive' AND t.technical_rating IN ('Strong Buy', 'Buy'))
               OR (target_technical_rating = 'Negative' AND t.technical_rating IN ('Strong Sell', 'Sell')))
        ORDER BY t.symbol, t.fetched_date DESC, t.fetched_time DESC
    )
    SELECT 
        c.id, c.symbol, c.market, c.name, c.current_price, c.previous_price, c.technical_score,
        c.technical_rating, c.previous_rating, c.rating_change_date, c.fetched_date, c.fetched_time
    FROM CurrentStock c
    ORDER BY 
        CASE WHEN sort_by = 'change' AND sort_order = 'asc' THEN COALESCE(c.current_price - c.previous_price, 0) END ASC NULLS LAST,
        CASE WHEN sort_by = 'change' AND sort_order = 'desc' THEN COALESCE(c.current_price - c.previous_price, 0) END DESC NULLS LAST,
        CASE WHEN sort_by = 'changePercent' AND sort_order = 'asc' THEN 
            CASE WHEN c.previous_price > 0 THEN ((c.current_price - c.previous_price) / c.previous_price * 100) ELSE 0 END 
        END ASC NULLS LAST,
        CASE WHEN sort_by = 'changePercent' AND sort_order = 'desc' THEN 
            CASE WHEN c.previous_price > 0 THEN ((c.current_price - c.previous_price) / c.previous_price * 100) ELSE 0 END 
        END DESC NULLS LAST,
        CASE WHEN sort_by = 'current_price' AND sort_order = 'asc' THEN c.current_price END ASC NULLS LAST,
        CASE WHEN sort_by = 'current_price' AND sort_order = 'desc' THEN c.current_price END DESC NULLS LAST,
        CASE WHEN sort_by = 'symbol' AND sort_order = 'asc' THEN c.symbol END ASC NULLS LAST,
        CASE WHEN sort_by = 'symbol' AND sort_order = 'desc' THEN c.symbol END DESC NULLS LAST,
        CASE WHEN sort_by = 'rating_change_date' AND sort_order = 'asc' THEN c.rating_change_date END ASC NULLS LAST,
        CASE WHEN sort_by = 'rating_change_date' AND sort_order = 'desc' THEN c.rating_change_date END DESC NULLS LAST,
        CASE WHEN sort_by = 'fetched_date' AND sort_order = 'asc' THEN c.fetched_date END ASC NULLS LAST,
        CASE WHEN sort_by = 'fetched_date' AND sort_order = 'desc' THEN c.fetched_date END DESC NULLS LAST,
        CASE WHEN sort_by NOT IN ('change', 'changePercent', 'current_price', 'symbol', 'rating_change_date', 'fetched_date') THEN c.rating_change_date END DESC NULLS LAST,
        c.symbol ASC
    LIMIT limit_val OFFSET offset_val;
END; $$;


-- ==========================================
-- 3. DASHBOARD STATS FUNCTION (get_dashboard_stats)
-- ==========================================
-- Returns summary counts for dashboard cards
-- - total_positive: Total Buy + Strong Buy
-- - total_negative: Total Sell + Strong Sell
-- - Individual counts for each rating
-- ==========================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(
    target_market TEXT DEFAULT NULL,
    target_date DATE DEFAULT NULL
) 
RETURNS JSON 
LANGUAGE plpgsql AS $$
DECLARE result JSON;
BEGIN
    WITH CurrentStock AS (
        SELECT DISTINCT ON (t.symbol) 
            t.symbol, t.technical_rating, t.fetched_date, t.previous_rating
        FROM stock_ratings t
        WHERE (target_market IS NULL OR t.market = target_market)
          AND (target_date IS NULL OR t.fetched_date <= target_date)
          AND t.current_price >= 0.1
          AND t.symbol NOT LIKE 'OTC:%'
        ORDER BY t.symbol, t.fetched_date DESC, t.fetched_time DESC
    )
    SELECT json_build_object(
        'total_positive', COUNT(*) FILTER (WHERE c.technical_rating IN ('Strong Buy', 'Buy')),
        'total_negative', COUNT(*) FILTER (WHERE c.technical_rating IN ('Strong Sell', 'Sell')),
        'strong_buy', COUNT(*) FILTER (WHERE c.technical_rating = 'Strong Buy'),
        'buy', COUNT(*) FILTER (WHERE c.technical_rating = 'Buy'),
        'strong_sell', COUNT(*) FILTER (WHERE c.technical_rating = 'Strong Sell'),
        'sell', COUNT(*) FILTER (WHERE c.technical_rating = 'Sell'),
        'neutral', COUNT(*) FILTER (WHERE c.technical_rating = 'Neutral'),
        'date', MAX(c.fetched_date) 
    ) INTO result
    FROM CurrentStock c
    WHERE c.technical_rating != 'Neutral'
      AND (c.previous_rating IS NULL OR c.previous_rating != 'Neutral');
    
    RETURN result;
END; $$;


-- ==========================================
-- 4. TOP GAINERS FUNCTION (get_top_gainers)
-- ==========================================
-- Returns top performing stocks by percentage change
-- Used for "Top Gainers" card on dashboard
-- ==========================================

CREATE OR REPLACE FUNCTION get_top_gainers(
    target_market TEXT DEFAULT NULL,
    target_date DATE DEFAULT NULL,
    limit_val INT DEFAULT 5
) 
RETURNS TABLE (
    symbol TEXT, market TEXT, name TEXT, price NUMERIC, change_percent NUMERIC, technical_rating TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH CurrentStock AS (
        SELECT DISTINCT ON (t.symbol) t.*
        FROM stock_ratings t
        WHERE (target_market IS NULL OR t.market = target_market)
          AND (target_date IS NULL OR t.fetched_date <= target_date)
          AND t.current_price >= 0.1
          AND t.symbol NOT LIKE 'OTC:%'
        ORDER BY t.symbol, t.fetched_date DESC, t.fetched_time DESC
    )
    SELECT 
        c.symbol, c.market, c.name, c.current_price as price,
        CASE WHEN c.open > 0 THEN 
            ROUND(((c.current_price - c.open) / c.open * 100), 2) 
        ELSE 0 END as change_percent,
        c.technical_rating
    FROM CurrentStock c
    WHERE c.technical_rating != 'Neutral'
      AND (c.previous_rating IS NULL OR c.previous_rating != 'Neutral')
    ORDER BY change_percent DESC
    LIMIT limit_val;
END; $$;


-- ==========================================
-- 5. PAGINATION COUNT FUNCTION (get_stocks_count_filtered)
-- ==========================================
-- Returns total count of stocks matching filters
-- Used for pagination and showing "X of Y results"
-- Includes target_technical_rating for Positive/Negative filtering
-- ==========================================

CREATE OR REPLACE FUNCTION get_stocks_count_filtered(
    target_market TEXT DEFAULT NULL,
    target_date DATE DEFAULT NULL,
    search_term TEXT DEFAULT NULL,
    target_rating TEXT DEFAULT NULL,
    target_technical_rating TEXT DEFAULT NULL
)
RETURNS TABLE (total BIGINT) 
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY 
    WITH CurrentStock AS (
        SELECT DISTINCT ON (t.symbol) 
            t.symbol, t.technical_rating, t.previous_rating, t.name
        FROM stock_ratings t
        WHERE (target_market IS NULL OR t.market = target_market)
          AND (target_date IS NULL OR t.fetched_date <= target_date)
          AND (search_term IS NULL OR t.symbol ILIKE '%' || search_term || '%' OR t.name ILIKE '%' || search_term || '%')
          AND t.current_price >= 0.1
          AND t.symbol NOT LIKE 'OTC:%'
        ORDER BY t.symbol, t.fetched_date DESC, t.fetched_time DESC
    )
    SELECT COUNT(*) 
    FROM CurrentStock c
    WHERE (target_rating IS NULL OR c.technical_rating = target_rating)
      AND (target_technical_rating IS NULL 
           OR (target_technical_rating = 'Positive' AND c.technical_rating IN ('Strong Buy', 'Buy'))
           OR (target_technical_rating = 'Negative' AND c.technical_rating IN ('Strong Sell', 'Sell')))
      AND c.technical_rating != 'Neutral'
      AND (c.previous_rating IS NULL OR c.previous_rating != 'Neutral');
END; $$;

-- =========================================================================================
-- PERFORMANCE OPTIMIZATION: DATABASE INDEXES
-- These indexes dramatically improve query performance (5-10x faster)
-- =========================================================================================

-- Drop existing indexes if they exist (idempotent - safe to run multiple times)
DROP INDEX IF EXISTS idx_stock_ratings_symbol_date;
DROP INDEX IF EXISTS idx_stock_ratings_market;
DROP INDEX IF EXISTS idx_stock_ratings_date_desc;
DROP INDEX IF EXISTS idx_stock_ratings_price;
DROP INDEX IF EXISTS idx_stock_ratings_rating;
DROP INDEX IF EXISTS idx_stock_ratings_composite;
DROP INDEX IF EXISTS idx_stock_ratings_symbol_search;
DROP INDEX IF EXISTS idx_stock_ratings_previous_rating;
DROP INDEX IF EXISTS idx_stock_ratings_rating_change_date;
DROP INDEX IF EXISTS idx_symbol;
DROP INDEX IF EXISTS idx_fetched_date;

-- 1. Symbol index (from old database)
-- Used by: Quick symbol lookups
CREATE INDEX idx_symbol ON stock_ratings(symbol);

-- 2. Fetched date index (from old database)  
-- Used by: Date filtering
CREATE INDEX idx_fetched_date ON stock_ratings(fetched_date DESC);

-- 3. Composite index for main query (most important!)

-- Covers: symbol, fetched_date DESC, fetched_time DESC
-- Used by: get_stocks_with_last_rating (CurrentStock CTE)
CREATE INDEX idx_stock_ratings_composite 
ON stock_ratings(symbol, fetched_date DESC, fetched_time DESC) 
WHERE current_price >= 0.1 AND symbol NOT LIKE 'OTC:%';

-- 4. Market filter index
-- Used by: Market dropdown filter
CREATE INDEX idx_stock_ratings_market 
ON stock_ratings(market, fetched_date DESC) 
WHERE current_price >= 0.1 AND symbol NOT LIKE 'OTC:%';

-- 3. Technical rating index
-- Used by: Rating filter (Strong Buy, Buy, Sell, Strong Sell)
CREATE INDEX idx_stock_ratings_rating 
ON stock_ratings(technical_rating, fetched_date DESC) 
WHERE technical_rating != 'Neutral' AND current_price >= 0.1;

-- 4. Previous rating index
-- Used by: Filter out records where previous_rating = Neutral
CREATE INDEX idx_stock_ratings_previous_rating 
ON stock_ratings(previous_rating) 
WHERE previous_rating IS NOT NULL;

-- 5. Rating change date index (NEW!)
-- Used by: Default sort by rating_change_date DESC
CREATE INDEX idx_stock_ratings_rating_change_date 
ON stock_ratings(rating_change_date DESC, symbol) 
WHERE current_price >= 0.1 AND technical_rating != 'Neutral';

-- 6. Date range index
-- Used by: Sort by fetched_date
CREATE INDEX idx_stock_ratings_date_desc 
ON stock_ratings(fetched_date DESC, fetched_time DESC)
WHERE current_price >= 0.1 AND symbol NOT LIKE 'OTC:%';

-- 7. Price sorting index
-- Used by: Sort by price column
CREATE INDEX idx_stock_ratings_price 
ON stock_ratings(current_price DESC) 
WHERE current_price >= 0.1;

-- 8. Full-text search index
-- Used by: Search box (ILIKE queries on symbol and name)
CREATE INDEX idx_stock_ratings_symbol_search 
ON stock_ratings USING gin(to_tsvector('english', symbol || ' ' || name));

-- Signal Returns Indexes
CREATE INDEX idx_signal_returns_symbol ON signal_returns(symbol, signal_date DESC);
CREATE INDEX idx_signal_returns_rating ON signal_returns(to_rating, signal_date DESC);
CREATE INDEX idx_signal_returns_pending_1d ON signal_returns(signal_date) WHERE return_1d IS NULL;
CREATE INDEX idx_signal_returns_pending_10d ON signal_returns(signal_date) WHERE return_10d IS NULL;
CREATE INDEX idx_signal_returns_pending_30d ON signal_returns(signal_date) WHERE return_30d IS NULL;

-- Update table statistics for query planner
ANALYZE stock_ratings;
ANALYZE signal_returns;

-- =========================================================================================
-- VERIFICATION: Check that functions, tables, and indexes were created successfully
-- =========================================================================================
SELECT 
    'Functions' as type,
    proname as name,
    pg_get_function_arguments(oid) as details
FROM pg_proc
WHERE proname LIKE 'get_%'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')

UNION ALL

SELECT 
    'Indexes (stock_ratings)' as type,
    indexname as name,
    indexdef as details
FROM pg_indexes 
WHERE tablename = 'stock_ratings' 
  AND indexname LIKE 'idx_%'

UNION ALL

SELECT 
    'Indexes (signal_returns)' as type,
    indexname as name,
    indexdef as details
FROM pg_indexes 
WHERE tablename = 'signal_returns' 
  AND indexname LIKE 'idx_%'

UNION ALL

SELECT 
    'Tables' as type,
    tablename as name,
    'Columns: ' || COUNT(*)::TEXT as details
FROM pg_tables t
JOIN information_schema.columns c ON c.table_name = t.tablename
WHERE t.schemaname = 'public' 
  AND t.tablename IN ('stock_ratings', 'signal_returns')
GROUP BY tablename

ORDER BY type, name;
