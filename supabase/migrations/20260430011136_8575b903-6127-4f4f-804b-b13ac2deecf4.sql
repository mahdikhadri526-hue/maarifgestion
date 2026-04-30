CREATE TABLE public.weekly_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiche_type TEXT NOT NULL,
  week_start TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  row_index INTEGER NOT NULL DEFAULT 0,
  article TEXT,
  lot_number TEXT,
  couleur TEXT,
  odeur TEXT,
  texture TEXT,
  stock_initial NUMERIC,
  entrees NUMERIC,
  sorties NUMERIC,
  visa_operateur TEXT,
  visa_manager TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to weekly_tracking"
  ON public.weekly_tracking
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER weekly_tracking_set_updated_at
  BEFORE UPDATE ON public.weekly_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_weekly_tracking_lookup
  ON public.weekly_tracking (fiche_type, week_start);