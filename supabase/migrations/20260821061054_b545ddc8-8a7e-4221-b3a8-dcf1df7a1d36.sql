GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_catalog TO authenticated;
GRANT ALL ON public.product_catalog TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecart_lines TO authenticated;
GRANT ALL ON public.ecart_lines TO service_role;