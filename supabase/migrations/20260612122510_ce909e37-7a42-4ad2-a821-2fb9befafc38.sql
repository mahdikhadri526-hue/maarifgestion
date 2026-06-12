CREATE TABLE public.cleaning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone text NOT NULL,
  log_date date NOT NULL,
  collaborateur text NOT NULL,
  tasks jsonb NOT NULL DEFAULT '{}'::jsonb,
  visa_manager text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaning_logs TO authenticated;
GRANT ALL ON public.cleaning_logs TO service_role;
ALTER TABLE public.cleaning_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cleaning" ON public.cleaning_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cleaning" ON public.cleaning_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cleaning" ON public.cleaning_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cleaning" ON public.cleaning_logs FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_cleaning_logs_updated BEFORE UPDATE ON public.cleaning_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX cleaning_logs_zone_date_idx ON public.cleaning_logs (zone, log_date DESC);