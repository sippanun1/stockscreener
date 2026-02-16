-- =========================================================================================
-- MIGRATION: 08_add_sector_filter
-- Description: Adds sector indexing and updates functions to support sector filtering.
-- =========================================================================================

-- 1. Add Index for Performance
-- =========================================================================================
CREATE INDEX IF NOT EXISTS idx_stock_ratings_sector ON public.stock_ratings (sector);
-- Also index industry just in case we need it later
CREATE INDEX IF NOT EXISTS idx_stock_ratings_industry ON public.stock_ratings (industry);


-- 2. Create Helper Function to Get Distinct Sectors
-- =========================================================================================
CREATE OR REPLACE FUNCTION public.get_sectors()
RETURNS TABLE (sector TEXT) LANGUAGE sql STABLE AS $$
    SELECT DISTINCT sector FROM public.stock_ratings WHERE sector IS NOT NULL AND sector != '' ORDER BY sector;
$$;


-- 3. Update Stocks Count Function
-- =========================================================================================
CREATE OR REPLACE FUNCTION public.get_stocks_count_filtered(
    p_market TEXT DEFAULT NULL, 
    p_date DATE DEFAULT NULL, 
    p_search TEXT DEFAULT NULL, 
    p_rating TEXT DEFAULT NULL, 
    p_tech_rating TEXT DEFAULT NULL, 
    p_lookback INT DEFAULT 60,
    p_sector TEXT DEFAULT NULL  -- [NEW]
)
RETURNS TABLE (res_total BIGINT) LANGUAGE plpgsql AS $$
DECLARE v_base_date DATE := COALESCE(p_date, CURRENT_DATE);
BEGIN
    RETURN QUERY 
    WITH RECURSIVE LatestIds AS (
        (SELECT id, symbol FROM public.stock_ratings 
         WHERE fetched_date >= (v_base_date - (COALESCE(p_lookback, 60) || ' days')::INTERVAL) AND fetched_date <= v_base_date
         ORDER BY symbol ASC, fetched_date DESC, fetched_time DESC LIMIT 1)
        UNION ALL
        SELECT sr.id, sr.symbol FROM LatestIds t,
        LATERAL (
            SELECT s.id, s.symbol FROM public.stock_ratings s 
            WHERE s.symbol > t.symbol AND s.fetched_date >= (v_base_date - (COALESCE(p_lookback, 60) || ' days')::INTERVAL) AND s.fetched_date <= v_base_date
            ORDER BY s.symbol ASC, s.fetched_date DESC, s.fetched_time DESC LIMIT 1
        ) sr
    ),
    UniqueStocks AS (
        SELECT sr.technical_rating, sr.current_price, sr.market, sr.symbol, sr.name, sr.sector
        FROM LatestIds l JOIN public.stock_ratings sr ON sr.id = l.id
        WHERE (p_market IS NULL OR p_market = '' OR sr.market = p_market)
        AND sr.symbol NOT LIKE 'OTC:%'
        AND (p_search IS NULL OR p_search = '' OR sr.symbol ILIKE '%' || p_search || '%' OR sr.name ILIKE '%' || p_search || '%')
        AND (p_sector IS NULL OR p_sector = '' OR sr.sector = p_sector) -- [NEW]
    )
    SELECT COUNT(*) FROM UniqueStocks u
    WHERE u.current_price >= 0.2 AND u.technical_rating != 'Neutral'
    AND (p_rating IS NULL OR p_rating = '' OR u.technical_rating = p_rating)
    AND (p_tech_rating IS NULL OR p_tech_rating = ''
        OR (p_tech_rating = 'Positive' AND u.technical_rating IN ('Strong Buy', 'Buy'))
        OR (p_tech_rating = 'Negative' AND u.technical_rating IN ('Strong Sell', 'Sell')));
END; $$;


-- 4. Update Main Get Stocks Function
-- =========================================================================================
CREATE OR REPLACE FUNCTION public.get_stocks(
    p_market TEXT DEFAULT NULL, 
    p_date DATE DEFAULT NULL, 
    p_search TEXT DEFAULT NULL,
    p_rating TEXT DEFAULT NULL, 
    p_tech_rating TEXT DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'rating_change_date', 
    p_sort_order TEXT DEFAULT 'desc',
    p_limit INTEGER DEFAULT 50, 
    p_offset INTEGER DEFAULT 0, 
    p_lookback INTEGER DEFAULT 60,
    p_sector TEXT DEFAULT NULL -- [NEW]
)
RETURNS TABLE (
    res_id BIGINT,
    res_symbol TEXT,
    res_market TEXT,
    res_name TEXT,
    res_current_price NUMERIC,
    res_open NUMERIC,
    res_premarket_close NUMERIC,
    res_premarket_open NUMERIC,
    res_postmarket_close NUMERIC,
    res_postmarket_open NUMERIC,
    res_sector TEXT,
    res_industry TEXT,
    res_previous_price NUMERIC,
    res_change NUMERIC,
    res_change_pct NUMERIC,
    res_technical_score NUMERIC,
    res_technical_rating TEXT,
    res_previous_rating TEXT,
    res_rating_change_date DATE,
    res_fetched_date DATE,
    res_fetched_time TIME
) AS $$
DECLARE v_base_date DATE := COALESCE(p_date, CURRENT_DATE);
BEGIN
    RETURN QUERY
    WITH RECURSIVE LatestIds AS (
        (SELECT id, symbol FROM public.stock_ratings 
         WHERE fetched_date >= (v_base_date - (COALESCE(p_lookback, 60) || ' days')::INTERVAL) AND fetched_date <= v_base_date
         ORDER BY symbol ASC, fetched_date DESC, fetched_time DESC LIMIT 1)
        UNION ALL
        SELECT sr.id, sr.symbol FROM LatestIds t,
        LATERAL (
            SELECT s.id, s.symbol FROM public.stock_ratings s 
            WHERE s.symbol > t.symbol AND s.fetched_date >= (v_base_date - (COALESCE(p_lookback, 60) || ' days')::INTERVAL) AND s.fetched_date <= v_base_date
            ORDER BY s.symbol ASC, s.fetched_date DESC, s.fetched_time DESC LIMIT 1
        ) sr
    ),
    LatestPerSymbol AS (
        SELECT sr.id, sr.symbol, sr.daily_change_percent, sr.daily_change_amount, 
               sr.technical_rating, sr.current_price, sr.rating_change_date, sr.market, sr.name,
                sr.fetched_date, sr.fetched_time, sr.technical_score, sr.prev_close_price,
                sr.open, sr.premarket_close, sr.premarket_open, sr.postmarket_close, sr.postmarket_open,
                sr.sector, sr.industry,
                -- Extract exchange and symbol parts for proper sorting
               -- exchange: everything before ':', fallback to symbol if no ':'
               SPLIT_PART(sr.symbol, ':', 1) as exchange,
               -- symbol_only: everything after ':', fallback to full symbol if no ':'
               COALESCE(NULLIF(SPLIT_PART(sr.symbol, ':', 2), ''), sr.symbol) as symbol_only
        FROM LatestIds l JOIN public.stock_ratings sr ON sr.id = l.id
        WHERE (p_market IS NULL OR p_market = '' OR sr.market = p_market)
        AND sr.symbol NOT LIKE 'OTC:%'
        AND (p_search IS NULL OR p_search = '' OR sr.symbol ILIKE '%' || p_search || '%' OR sr.name ILIKE '%' || p_search || '%')
        AND (p_sector IS NULL OR p_sector = '' OR sr.sector = p_sector) -- [NEW]
    ),
    CandidateIds AS (
        SELECT l.*
        FROM LatestPerSymbol l
        WHERE l.current_price >= 0.2 AND l.technical_rating != 'Neutral'
          AND (p_rating IS NULL OR p_rating = '' OR l.technical_rating = p_rating)
          AND (p_tech_rating IS NULL OR p_tech_rating = ''
               OR (p_tech_rating = 'Positive' AND l.technical_rating IN ('Strong Buy', 'Buy'))
               OR (p_tech_rating = 'Negative' AND l.technical_rating IN ('Strong Sell', 'Sell')))
    ),
    SortedIds AS (
        SELECT * FROM CandidateIds
        ORDER BY
            -- Handle search ranking
            CASE WHEN p_search IS NOT NULL AND p_search != '' THEN 
                CASE WHEN symbol ILIKE p_search THEN 0 
                    WHEN symbol ILIKE p_search || '%' THEN 1 
                    ELSE 2 END
            END ASC,
            -- Core Sorting
            CASE WHEN p_sort_by = 'top_gainers' THEN daily_change_percent END DESC NULLS LAST,
            CASE WHEN p_sort_by = 'changePercent' AND p_sort_order = 'asc' THEN daily_change_percent END ASC NULLS LAST,
            CASE WHEN p_sort_by = 'changePercent' AND p_sort_order = 'desc' THEN daily_change_percent END DESC NULLS LAST,
            CASE WHEN p_sort_by = 'change' AND p_sort_order = 'asc' THEN daily_change_amount END ASC NULLS LAST,
            CASE WHEN p_sort_by = 'change' AND p_sort_order = 'desc' THEN daily_change_amount END DESC NULLS LAST,
            CASE WHEN p_sort_by = 'current_price' AND p_sort_order = 'asc' THEN current_price END ASC NULLS LAST,
            CASE WHEN p_sort_by = 'current_price' AND p_sort_order = 'desc' THEN current_price END DESC NULLS LAST,
            CASE WHEN p_sort_by = 'symbol' AND p_sort_order = 'asc' THEN symbol_only END ASC NULLS LAST,
            CASE WHEN p_sort_by = 'symbol' AND p_sort_order = 'desc' THEN symbol_only END DESC NULLS LAST,
            CASE WHEN p_sort_by = 'exchange' AND p_sort_order = 'asc' THEN exchange END ASC NULLS LAST,
            CASE WHEN p_sort_by = 'exchange' AND p_sort_order = 'desc' THEN exchange END DESC NULLS LAST,
            CASE WHEN p_sort_by = 'rating_change_date' AND p_sort_order = 'asc' THEN rating_change_date END ASC NULLS LAST,
            CASE WHEN p_sort_by = 'rating_change_date' AND p_sort_order = 'desc' THEN rating_change_date END DESC NULLS LAST,
            symbol ASC
        LIMIT p_limit OFFSET p_offset
    ),
    WithFullData AS (
        SELECT s.*, 
            pre.h_rating,
            pre.h_price
        FROM SortedIds s
        LEFT JOIN LATERAL (
            SELECT p.technical_rating as h_rating, p.current_price as h_price
            FROM public.stock_ratings p 
            WHERE p.symbol = s.symbol 
            AND (p.fetched_date < s.fetched_date OR (p.fetched_date = s.fetched_date AND p.fetched_time < s.fetched_time))
            AND p.technical_rating != s.technical_rating AND p.technical_rating != 'Neutral'
            ORDER BY p.fetched_date DESC, p.fetched_time DESC LIMIT 1) pre ON TRUE
    )
    SELECT 
        w.id, w.symbol, w.market, w.name, w.current_price, 
        w.open, w.premarket_close, w.premarket_open, w.postmarket_close, w.postmarket_open,
        w.sector, w.industry,
        COALESCE(NULLIF(w.prev_close_price, 0), w.h_price, 0), -- Use prev_close_price instead of previous_price
        COALESCE(w.daily_change_amount, 0), 
        COALESCE(w.daily_change_percent, 0),
        w.technical_score, w.technical_rating, 
        COALESCE(w.h_rating, 'N/A'),
        w.rating_change_date, w.fetched_date, w.fetched_time
    FROM WithFullData w
    ORDER BY -- Maintain final presentation order
        CASE WHEN p_search IS NOT NULL AND p_search != '' THEN 
            CASE WHEN w.symbol ILIKE p_search THEN 0 
                WHEN w.symbol ILIKE p_search || '%' THEN 1 
                ELSE 2 END
        END ASC,
        CASE WHEN p_sort_by = 'top_gainers' THEN w.daily_change_percent END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'changePercent' AND p_sort_order = 'asc' THEN w.daily_change_percent END ASC NULLS LAST,
        CASE WHEN p_sort_by = 'changePercent' AND p_sort_order = 'desc' THEN w.daily_change_percent END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'change' AND p_sort_order = 'asc' THEN w.daily_change_amount END ASC NULLS LAST,
        CASE WHEN p_sort_by = 'change' AND p_sort_order = 'desc' THEN w.daily_change_amount END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'current_price' AND p_sort_order = 'asc' THEN w.current_price END ASC NULLS LAST,
        CASE WHEN p_sort_by = 'current_price' AND p_sort_order = 'desc' THEN w.current_price END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'symbol' AND p_sort_order = 'asc' THEN w.symbol_only END ASC NULLS LAST,
        CASE WHEN p_sort_by = 'symbol' AND p_sort_order = 'desc' THEN w.symbol_only END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'exchange' AND p_sort_order = 'asc' THEN w.exchange END ASC NULLS LAST,
        CASE WHEN p_sort_by = 'exchange' AND p_sort_order = 'desc' THEN w.exchange END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'rating_change_date' AND p_sort_order = 'asc' THEN w.rating_change_date END ASC NULLS LAST,
        CASE WHEN p_sort_by = 'rating_change_date' AND p_sort_order = 'desc' THEN w.rating_change_date END DESC NULLS LAST,
        w.symbol ASC;
END; $$ LANGUAGE plpgsql;

-- Notifying schema reload to ensure Supabase picks up changes
NOTIFY pgrst, 'reload schema';
