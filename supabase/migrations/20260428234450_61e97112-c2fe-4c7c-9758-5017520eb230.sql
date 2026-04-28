CREATE TABLE public.autocontrols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiche_type TEXT NOT NULL,
  control_date TEXT NOT NULL,
  collaborateur TEXT NOT NULL,
  article TEXT NOT NULL,
  lot_number TEXT,
  quantity NUMERIC,
  dlc TEXT,
  visa_manager TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.autocontrols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to autocontrols"
ON public.autocontrols
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_autocontrols_updated_at
BEFORE UPDATE ON public.autocontrols
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_autocontrols_date ON public.autocontrols(control_date);
CREATE INDEX idx_autocontrols_type ON public.autocontrols(fiche_type);