REVOKE ALL ON FUNCTION public.stock_movement_aggregates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_movement_aggregates() TO service_role;