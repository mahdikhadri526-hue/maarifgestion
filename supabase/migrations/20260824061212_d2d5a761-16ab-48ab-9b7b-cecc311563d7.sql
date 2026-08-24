REVOKE ALL ON FUNCTION public.stock_movement_aggregates(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stock_period_aggregates(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.weekly_tracking_filtered(uuid, text, text[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_movement_aggregates(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stock_period_aggregates(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_tracking_filtered(uuid, text, text[], date, date) TO authenticated, service_role;