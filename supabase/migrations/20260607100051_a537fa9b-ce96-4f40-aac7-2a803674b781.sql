DROP POLICY IF EXISTS "Realtime stock_ref_conversions read" ON realtime.messages;
CREATE POLICY "Realtime stock_ref_conversions read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE '%stock_ref_conversions%')
  AND public.has_permission(auth.uid(), 'view_stock')
);