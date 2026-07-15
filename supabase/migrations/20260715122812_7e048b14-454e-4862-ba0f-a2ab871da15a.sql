
CREATE TABLE public.order_placed_products (
  product_id TEXT PRIMARY KEY,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_placed_products TO authenticated;
GRANT ALL ON public.order_placed_products TO service_role;
ALTER TABLE public.order_placed_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read order_placed" ON public.order_placed_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert order_placed" ON public.order_placed_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update order_placed" ON public.order_placed_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete order_placed" ON public.order_placed_products FOR DELETE TO authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_placed_products;
