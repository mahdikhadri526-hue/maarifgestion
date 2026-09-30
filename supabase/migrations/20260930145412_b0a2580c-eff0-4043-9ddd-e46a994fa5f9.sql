CREATE TABLE public.mise_en_place_weekly (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  week_start date NOT NULL DEFAULT (date_trunc('week', now())::date),
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, product_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mise_en_place_weekly TO authenticated;
GRANT ALL ON public.mise_en_place_weekly TO service_role;

ALTER TABLE public.mise_en_place_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mise_en_place_weekly select" ON public.mise_en_place_weekly
FOR SELECT TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "mise_en_place_weekly insert" ON public.mise_en_place_weekly
FOR INSERT TO authenticated WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "mise_en_place_weekly update" ON public.mise_en_place_weekly
FOR UPDATE TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id))
WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "mise_en_place_weekly delete" ON public.mise_en_place_weekly
FOR DELETE TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));

CREATE TRIGGER update_mise_en_place_weekly_updated_at
BEFORE UPDATE ON public.mise_en_place_weekly
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();