
-- 03_functions_ui.sql
-- =========================================================================================
-- STEP 3: UI & Dashboard Functions
-- =========================================================================================

-- 1. DROP EXISTING
DROP FUNCTION IF EXISTS public.get_dashboard_stats_v3(text,date);
DROP FUNCTION IF EXISTS public.get_stocks_count_filtered(text,date,text,text,text);
DROP FUNCTION IF EXISTS public.get_top_gainers_v3(text,date,integer);

-- 2. DASHBOARD STATS (V3)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_v3(
    target_market TEXT DEFAULT NULL,
    target_date DATE DEFAULT NULL
) 
RETURNS JSON 
LANGUAGE plpgsql AS $$
DECLARE 
    result JSON;
    base_date DATE := COALESCE(target_date, CURRENT_DATE);
BEGIN
    WITH StockCandidates AS (
        SELECT sr.*
        FROM public.stock_ratings sr
        WHERE sr.fetched_date >= (base_date - INTERVAL '30 days')
          AND sr.fetched_date <= base_date
          AND (target_market IS NULL OR target_market = '' OR sr.market = target_market)
          AND sr.symbol NOT LIKE 'OTC:%'
    ),
    UniqueStocks AS (
        SELECT DISTINCT ON (t.symbol) t.*
        FROM StockCandidates t
        ORDER BY t.symbol, t.fetched_date DESC, t.fetched_time DESC
    )
    SELECT json_build_object(
        'total_positive', COUNT(*) FILTER (WHERE u.technical_rating IN ('Strong Buy', 'Buy')),
        'total_negative', COUNT(*) FILTER (WHERE u.technical_rating IN ('Strong Sell', 'Sell')),
        'strong_buy', COUNT(*) FILTER (WHERE u.technical_rating = 'Strong Buy'),
        'buy', COUNT(*) FILTER (WHERE u.technical_rating = 'Buy'),
        'strong_sell', COUNT(*) FILTER (WHERE u.technical_rating = 'Strong Sell'),
        'sell', COUNT(*) FILTER (WHERE u.technical_rating = 'Sell'),
        'neutral', COUNT(*) FILTER (WHERE u.technical_rating = 'Neutral'),
        'date', MAX(u.fetched_date) 
    ) INTO result
    FROM UniqueStocks u
    WHERE u.current_price >= 0.1
      AND u.technical_rating != 'Neutral';
    
    RETURN result;
END; $$;

-- 3. TOTAL COUNT FILTERED (V3)
CREATE OR REPLACE FUNCTION public.get_stocks_count_filtered(
    target_market TEXT DEFAULT NULL,
    target_date DATE DEFAULT NULL,
    search_term TEXT DEFAULT NULL,
    target_rating TEXT DEFAULT NULL,
    target_technical_rating TEXT DEFAULT NULL
)
RETURNS TABLE (total BIGINT) 
LANGUAGE plpgsql AS $$
DECLARE
    base_date DATE := COALESCE(target_date, CURRENT_DATE);
    lookback_days INT := CASE WHEN (search_term IS NOT NULL AND search_term != '') THEN 365 ELSE 30 END;
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
        SELECT DISTINCT ON (t.symbol) 
            t.symbol, t.technical_rating, t.name, t.current_price
        FROM StockCandidates t
        WHERE (search_term IS NULL OR search_term = '' OR t.symbol ILIKE '%' || search_term || '%' OR t.name ILIKE '%' || search_term || '%')
        ORDER BY t.symbol, t.fetched_date DESC, t.fetched_time DESC
    )
    SELECT COUNT(*) 
    FROM UniqueStocks u
    WHERE u.current_price >= 0.1
      AND u.technical_rating != 'Neutral'
      AND (target_rating IS NULL OR target_rating = '' OR u.technical_rating = target_rating)
      AND (target_technical_rating IS NULL OR target_technical_rating = ''
           OR (target_technical_rating = 'Positive' AND u.technical_rating IN ('Strong Buy', 'Buy'))
           OR (target_technical_rating = 'Negative' AND u.technical_rating IN ('Strong Sell', 'Sell')));
END; $$;

-- 4. TOP GAINERS (V3)
CREATE OR REPLACE FUNCTION public.get_top_gainers_v3(
    target_market TEXT DEFAULT NULL,
    target_date DATE DEFAULT NULL,
    limit_val INT DEFAULT 3
)
RETURNS TABLE (
    symbol TEXT, market TEXT, name TEXT, change_percent NUMERIC
) 
LANGUAGE plpgsql AS $$
DECLARE
    base_date DATE := COALESCE(target_date, CURRENT_DATE);
BEGIN
    RETURN QUERY
    WITH StockCandidates AS (
        SELECT sr.*
        FROM public.stock_ratings sr
        WHERE sr.fetched_date >= (base_date - INTERVAL '30 days')
          AND sr.fetched_date <= base_date
          AND (target_market IS NULL OR target_market = '' OR sr.market = target_market)
          AND sr.symbol NOT LIKE 'OTC:%'
    ),
    UniqueStocks AS (
        SELECT DISTINCT ON (t.symbol) t.*
        FROM StockCandidates t
        ORDER BY t.symbol, t.fetched_date DESC, t.fetched_time DESC
    ),
    FilteredStocks AS (
        SELECT u.*
        FROM UniqueStocks u
        WHERE u.current_price >= 0.1
          AND u.technical_rating IN ('Strong Buy', 'Buy')
    ),
    WithHistory AS (
        SELECT 
            f.symbol as f_symbol, f.market as f_market, f.name as f_name, f.current_price as f_current_price,
            pre.h_price
        FROM FilteredStocks f
        LEFT JOIN LATERAL (
            SELECT p.current_price as h_price
            FROM public.stock_ratings p
            WHERE p.symbol = f.symbol
              AND (p.fetched_date < f.fetched_date OR (p.fetched_date = f.fetched_date AND p.fetched_time < f.fetched_time))
              AND p.technical_rating != f.technical_rating
              AND p.technical_rating != 'Neutral'
            ORDER BY p.fetched_date DESC, p.fetched_time DESC
            LIMIT 1
        ) pre ON TRUE
    )
    SELECT 
        w.f_symbol, w.f_market, w.f_name,
        CASE WHEN w.h_price > 0 THEN ((w.f_current_price - w.h_price) / w.h_price * 100) ELSE 0 END as change_percent
    FROM WithHistory w
    WHERE w.h_price > 0
    ORDER BY change_percent DESC
    LIMIT limit_val;
END; $$;
