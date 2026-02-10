-- 04_functions_screener.sql
-- =========================================================================================
-- STEP 4: Complex Screener Logic (V7.2 - Search Optimized)
-- =========================================================================================

-- 1. DROP EXISTING
DROP FUNCTION IF EXISTS public.get_stocks(text,date,text,text,text,text,text,integer,integer);
-- Drop old versions if they exist to clean up
DROP FUNCTION IF EXISTS public.get_stocks_v3(text,date,text,text,text,text,text,integer,integer);

-- 2. MAIN STOCK TABLE (Search Optimized)
CREATE OR REPLACE FUNCTION public.get_stocks(
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
    current_price NUMERIC, previous_price NUMERIC, 
    change NUMERIC, change_percent NUMERIC,
    technical_score NUMERIC, 
    "Technical_Rating" TEXT, "Previous_Rating" TEXT,
    rating_change_date DATE, fetched_date DATE, fetched_time TIME
) 
LANGUAGE plpgsql AS $$
DECLARE
    base_date DATE := COALESCE(target_date, CURRENT_DATE);
    -- Optimize lookback: if searching, look back 365 days; otherwise 90 days (catch older active stocks)
    lookback_days INT := CASE WHEN (search_term IS NOT NULL AND search_term != '') THEN 365 ELSE 90 END;
BEGIN
    RETURN QUERY
    WITH StockCandidates AS (
        SELECT sr.*
        FROM public.stock_ratings sr
        WHERE sr.fetched_date >= (base_date - (lookback_days || ' days')::INTERVAL)
          AND sr.fetched_date <= base_date
          AND (target_market IS NULL OR target_market = '' OR sr.market = target_market)
          AND sr.symbol NOT LIKE 'OTC:%'
    ),
    UniqueStocks AS (
        SELECT DISTINCT ON (t.symbol) t.*
        FROM StockCandidates t
        WHERE (search_term IS NULL OR search_term = '' OR t.symbol ILIKE '%' || search_term || '%' OR t.name ILIKE '%' || search_term || '%')
        ORDER BY t.symbol, t.fetched_date DESC, t.fetched_time DESC
    ),
    -- 1. First, efficiently select valid IDs with pagination
    -- This avoids doing the expensive LATERAL JOIN on all 21k rows
    TopStocks AS (
        SELECT 
            u.id, u.symbol, u.market, u.name, 
            u.current_price, u.technical_score, 
            u.technical_rating, u.rating_change_date, 
            u.fetched_date, u.fetched_time,
            -- Use stored values if available, otherwise calculate later
            u.change_percent, u.price_change, u.previous_price
        FROM UniqueStocks u
        WHERE u.current_price >= 0.2 -- UPDATED: Filter strictness increased to 0.2
          AND u.symbol NOT LIKE 'OTC:%' -- REINFORCED: Ensure no OTC in final set
          AND u.technical_rating != 'Neutral'
          AND (search_term IS NULL OR search_term = ''
               -- Optimization: Only check previous_rating if it's cheap, otherwise rely on stored column if exists
               -- OR (u.previous_rating IS NULL OR u.previous_rating != 'Neutral')
              )
          AND (target_rating IS NULL OR target_rating = '' OR u.technical_rating = target_rating)
          AND (target_technical_rating IS NULL OR target_technical_rating = ''
               OR (target_technical_rating = 'Positive' AND u.technical_rating IN ('Strong Buy', 'Buy'))
               OR (target_technical_rating = 'Negative' AND u.technical_rating IN ('Strong Sell', 'Sell')))
        ORDER BY 
            -- Optimized Sorting on reduced set
            CASE WHEN search_term IS NOT NULL AND search_term != '' THEN 
                CASE WHEN u.symbol ILIKE search_term THEN 0 
                     WHEN u.symbol ILIKE search_term || '%' THEN 1 
                     ELSE 2 END
            END ASC,
            CASE WHEN sort_by = 'change' AND sort_order = 'asc' THEN u.price_change END ASC NULLS LAST,
            CASE WHEN sort_by = 'change' AND sort_order = 'desc' THEN u.price_change END DESC NULLS LAST,
            CASE WHEN sort_by = 'changePercent' AND sort_order = 'asc' THEN u.change_percent END ASC NULLS LAST,
            CASE WHEN sort_by = 'changePercent' AND sort_order = 'desc' THEN u.change_percent END DESC NULLS LAST,
            CASE WHEN sort_by = 'current_price' AND sort_order = 'asc' THEN u.current_price END ASC NULLS LAST,
            CASE WHEN sort_by = 'current_price' AND sort_order = 'desc' THEN u.current_price END DESC NULLS LAST,
            CASE WHEN sort_by = 'symbol' AND sort_order = 'asc' THEN u.symbol END ASC NULLS LAST,
            CASE WHEN sort_by = 'symbol' AND sort_order = 'desc' THEN u.symbol END DESC NULLS LAST,
            CASE WHEN sort_by = 'rating_change_date' AND sort_order = 'asc' THEN u.rating_change_date END ASC NULLS LAST,
            CASE WHEN sort_by = 'rating_change_date' AND sort_order = 'desc' THEN u.rating_change_date END DESC NULLS LAST,
            -- Tie-breaker
            u.symbol ASC
        LIMIT limit_val OFFSET offset_val
    ),
    -- 2. NOW perform the heavy history lookup ONLY for the top 100 rows
    WithHistory AS (
        SELECT 
            t.*,
            pre.h_rating, 
            -- If stored previous_price is 0 (legacy data), try to get it from history
            COALESCE(NULLIF(t.previous_price, 0), pre.h_price, 0) as effective_prev_price
        FROM TopStocks t
        LEFT JOIN LATERAL (
            SELECT p.technical_rating as h_rating, p.current_price as h_price
            FROM public.stock_ratings p
            WHERE p.symbol = t.symbol
              AND (p.fetched_date < t.fetched_date OR (p.fetched_date = t.fetched_date AND p.fetched_time < t.fetched_time))
              AND p.technical_rating != t.technical_rating
              AND p.technical_rating != 'Neutral' -- Restored strict filtering per user request
            ORDER BY p.fetched_date DESC, p.fetched_time DESC
            LIMIT 1
        ) pre ON TRUE
    )
    SELECT 
        w.id, w.symbol, w.market, w.name, 
        w.current_price, 
        w.effective_prev_price as previous_price,
        w.price_change as change,
        w.change_percent,
        w.technical_score, w.technical_rating as "Technical_Rating",
        COALESCE(w.h_rating, 'N/A') as "Previous_Rating",
        w.rating_change_date, w.fetched_date, w.fetched_time
    FROM WithHistory w
    ORDER BY 
        -- Re-apply sort to ensure correct order after CTE (though usually preserved)
        CASE WHEN sort_by = 'rating_change_date' THEN w.rating_change_date END DESC,
        w.symbol ASC;
END; $$;
