CREATE TABLE public.product_pack_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id),
  product_id text NOT NULL,
  label text NOT NULL,
  pieces_per_unit numeric NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, product_id, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_pack_options TO authenticated;
GRANT ALL ON public.product_pack_options TO service_role;
ALTER TABLE public.product_pack_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read pack options" ON public.product_pack_options FOR SELECT TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "admin insert pack options" ON public.product_pack_options FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "admin update pack options" ON public.product_pack_options FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id)) WITH CHECK (public.is_admin(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "admin delete pack options" ON public.product_pack_options FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id));
COMMENT ON TABLE public.product_pack_options IS 'Conditionnements supplementaires par produit et par PDV (ex: paquet de 16 pour Oreo), geres par l''admin.';