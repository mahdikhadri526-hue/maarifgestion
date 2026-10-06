CREATE TABLE public.ecart_sale_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  zone text NOT NULL,
  name text NOT NULL,
  dose numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product, zone, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecart_sale_articles TO authenticated;
GRANT ALL ON public.ecart_sale_articles TO service_role;
ALTER TABLE public.ecart_sale_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ecart articles" ON public.ecart_sale_articles FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "insert ecart articles" ON public.ecart_sale_articles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR public.is_regional_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_ecarts'));
CREATE POLICY "update ecart articles" ON public.ecart_sale_articles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR public.is_regional_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_ecarts')) WITH CHECK (public.is_admin(auth.uid()) OR public.is_regional_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_ecarts'));
CREATE POLICY "delete ecart articles" ON public.ecart_sale_articles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR public.is_regional_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_ecarts'));
CREATE TRIGGER trg_ecart_sale_articles_updated BEFORE UPDATE ON public.ecart_sale_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();