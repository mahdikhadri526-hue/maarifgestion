CREATE TABLE public.mise_en_place_stocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mise_en_place_stocks TO authenticated;
GRANT ALL ON public.mise_en_place_stocks TO service_role;

ALTER TABLE public.mise_en_place_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mise_en_place select" ON public.mise_en_place_stocks
FOR SELECT TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "mise_en_place insert" ON public.mise_en_place_stocks
FOR INSERT TO authenticated WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "mise_en_place update" ON public.mise_en_place_stocks
FOR UPDATE TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id))
WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "mise_en_place delete" ON public.mise_en_place_stocks
FOR DELETE TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));

CREATE TRIGGER update_mise_en_place_stocks_updated_at
BEFORE UPDATE ON public.mise_en_place_stocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();