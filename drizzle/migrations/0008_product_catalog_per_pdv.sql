ALTER TABLE public.product_catalog ADD COLUMN pdv_id uuid REFERENCES public.pdvs(id) ON DELETE CASCADE;
ALTER TABLE public.product_catalog DROP CONSTRAINT IF EXISTS product_catalog_product_id_key;
INSERT INTO public.product_catalog (product_id, category, name, conditionnement, hidden, sort_order, pdv_id)
SELECT c.product_id, c.category, c.name, c.conditionnement, c.hidden, c.sort_order, p.id
FROM public.product_catalog c CROSS JOIN public.pdvs p WHERE c.pdv_id IS NULL;
CREATE UNIQUE INDEX product_catalog_pdv_product_key ON public.product_catalog (pdv_id, product_id);
COMMENT ON COLUMN public.product_catalog.pdv_id IS 'Rows with NULL pdv_id are DEPRECATED (former shared catalog, copied to every PDV).';