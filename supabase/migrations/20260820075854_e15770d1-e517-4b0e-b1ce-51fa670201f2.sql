CREATE TABLE public.product_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id text NOT NULL UNIQUE,
  category text NOT NULL,
  name text NOT NULL,
  conditionnement text NOT NULL DEFAULT '',
  hidden boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_catalog TO authenticated;
GRANT ALL ON public.product_catalog TO service_role;

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_catalog_select" ON public.product_catalog
FOR SELECT TO authenticated USING (true);

CREATE POLICY "product_catalog_insert" ON public.product_catalog
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_products'));

CREATE POLICY "product_catalog_update" ON public.product_catalog
FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_products'))
WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_products'));

CREATE POLICY "product_catalog_delete" ON public.product_catalog
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'delete_products'));

CREATE TRIGGER trg_product_catalog_updated_at
BEFORE UPDATE ON public.product_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();