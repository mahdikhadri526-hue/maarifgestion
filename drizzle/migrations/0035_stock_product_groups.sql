CREATE TABLE public.stock_product_groups (
 id text PRIMARY KEY,
 pdv_id uuid NOT NULL REFERENCES public.pdvs(id),
 name text NOT NULL CHECK (length(trim(name)) > 0),
 source_ids text[] NOT NULL CHECK (cardinality(source_ids) >= 1),
 exported boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_product_groups TO authenticated;
GRANT ALL ON public.stock_product_groups TO service_role;
ALTER TABLE public.stock_product_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_groups_read ON public.stock_product_groups FOR SELECT TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY stock_groups_insert ON public.stock_product_groups FOR INSERT TO authenticated WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'edit_stock'));
CREATE POLICY stock_groups_update ON public.stock_product_groups FOR UPDATE TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'edit_stock')) WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'edit_stock'));
CREATE POLICY stock_groups_delete ON public.stock_product_groups FOR DELETE TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'edit_stock'));
