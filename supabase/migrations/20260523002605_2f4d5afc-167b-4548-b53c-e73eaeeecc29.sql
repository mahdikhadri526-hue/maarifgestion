-- Enable RLS on realtime.messages and restrict subscriptions per topic/permission
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive permitted realtime" ON realtime.messages;

CREATE POLICY "Authenticated can receive permitted realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE '%stock_movements%' THEN public.has_permission(auth.uid(), 'view_movements')
    WHEN realtime.topic() LIKE '%initial_stocks%'  THEN public.has_permission(auth.uid(), 'view_stock')
    WHEN realtime.topic() LIKE '%lot_entries%'     THEN public.has_permission(auth.uid(), 'view_lots')
    WHEN realtime.topic() LIKE '%requisitions%'    THEN public.has_permission(auth.uid(), 'view_requisitions')
    WHEN realtime.topic() LIKE '%weekly_tracking%' THEN public.has_permission(auth.uid(), 'view_weekly')
    WHEN realtime.topic() LIKE '%autocontrols%'    THEN public.has_permission(auth.uid(), 'view_autocontrol')
    ELSE false
  END
);