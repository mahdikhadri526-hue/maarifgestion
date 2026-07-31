CREATE TABLE IF NOT EXISTS public.glace_storage_capacity (
  article TEXT PRIMARY KEY,
  capacity NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.glace_storage_capacity TO authenticated;
GRANT ALL ON public.glace_storage_capacity TO service_role;
ALTER TABLE public.glace_storage_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth can read capacity" ON public.glace_storage_capacity FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can write capacity" ON public.glace_storage_capacity FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.glace_storage_capacity;