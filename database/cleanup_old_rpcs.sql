-- Run this script to clean up old RPC functions before applying the new full_setup.sql or if you encounter RPC signature mismatch errors.

-- Drop old get_stocks function with the singular p_sector TEXT parameter
DROP FUNCTION IF EXISTS public.get_stocks(
    TEXT, DATE, TEXT, 
    TEXT, TEXT, 
    TEXT, TEXT, 
    INTEGER, INTEGER, INTEGER,
    TEXT, -- p_sector
    TEXT, -- p_previous_rating
    TEXT[], -- p_pinned_symbols
    INTEGER[] -- p_breakout_scores
);

-- Drop old get_stocks_count_filtered function with the singular p_sector TEXT parameter
DROP FUNCTION IF EXISTS public.get_stocks_count_filtered(
    TEXT, DATE, TEXT, 
    TEXT, TEXT, INTEGER,
    TEXT -- p_sector
);
