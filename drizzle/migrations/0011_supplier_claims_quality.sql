CREATE TABLE public.supplier_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id),
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  responsable text,
  fournisseur text,
  produit text,
  lot_number text,
  description text,
  quantite_nc text,
  action_prise text,
  statut text NOT NULL DEFAULT 'Ouverte',
  pieces_jointes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_claims TO authenticated;
GRANT ALL ON public.supplier_claims TO service_role;
ALTER TABLE public.supplier_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read supplier claims" ON public.supplier_claims FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.is_quality_account(auth.uid()));
CREATE POLICY "quality insert supplier claims" ON public.supplier_claims FOR INSERT TO authenticated
  WITH CHECK (public.is_quality_account(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "quality update supplier claims" ON public.supplier_claims FOR UPDATE TO authenticated
  USING (public.is_quality_account(auth.uid())) WITH CHECK (public.is_quality_account(auth.uid()));
CREATE POLICY "quality delete supplier claims" ON public.supplier_claims FOR DELETE TO authenticated
  USING (public.is_quality_account(auth.uid()));
CREATE TRIGGER supplier_claims_updated BEFORE UPDATE ON public.supplier_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();