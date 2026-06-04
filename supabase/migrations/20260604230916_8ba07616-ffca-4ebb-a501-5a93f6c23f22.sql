
CREATE TABLE public.saved_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_date text NOT NULL,
  category text NOT NULL,
  performed_by text,
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_items integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_orders TO authenticated;
GRANT ALL ON public.saved_orders TO service_role;
ALTER TABLE public.saved_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth select saved_orders" ON public.saved_orders FOR SELECT USING (has_permission(auth.uid(), 'view_stock'));
CREATE POLICY "auth insert saved_orders" ON public.saved_orders FOR INSERT WITH CHECK (has_permission(auth.uid(), 'view_stock'));
CREATE POLICY "auth update saved_orders" ON public.saved_orders FOR UPDATE USING (has_permission(auth.uid(), 'edit_stock'));
CREATE POLICY "auth delete saved_orders" ON public.saved_orders FOR DELETE USING (has_permission(auth.uid(), 'delete_stock'));
