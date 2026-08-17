CREATE TABLE public.ecart_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id),
  entry_date date NOT NULL,
  produit text NOT NULL,
  categorie text NOT NULL DEFAULT 'GLACE',
  zone text NOT NULL DEFAULT 'EMPORTER',
  stock_initial numeric NOT NULL DEFAULT 0,
  entrees numeric NOT NULL DEFAULT 0,
  stock_final numeric NOT NULL DEFAULT 0,
  ventes numeric NOT NULL DEFAULT 0,
  performed_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ecart_entries_zone_check CHECK (zone IN ('EMPORTER','SURPLACE')),
  CONSTRAINT ecart_entries_unique UNIQUE (pdv_id, entry_date, produit, zone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecart_entries TO authenticated;
GRANT ALL ON public.ecart_entries TO service_role;

ALTER TABLE public.ecart_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecart_select" ON public.ecart_entries FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "ecart_insert" ON public.ecart_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "ecart_update" ON public.ecart_entries FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id))
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "ecart_delete" ON public.ecart_entries FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.is_admin(auth.uid()));

CREATE INDEX idx_ecart_entries_pdv_date ON public.ecart_entries (pdv_id, entry_date);

CREATE TRIGGER update_ecart_entries_updated_at
  BEFORE UPDATE ON public.ecart_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();