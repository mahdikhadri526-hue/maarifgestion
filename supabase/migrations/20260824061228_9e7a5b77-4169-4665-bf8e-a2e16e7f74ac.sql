ALTER FUNCTION public.stock_movement_aggregates(uuid) SECURITY INVOKER;
ALTER FUNCTION public.stock_period_aggregates(uuid, date, date) SECURITY INVOKER;
ALTER FUNCTION public.weekly_tracking_filtered(uuid, text, text[], date, date) SECURITY INVOKER;