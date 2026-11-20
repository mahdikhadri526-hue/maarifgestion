CREATE TABLE public.weekly_article_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 pdv_id uuid NOT NULL REFERENCES public.pdvs(id),
 category text NOT NULL CHECK (category IN ('glace','fruits','nettoyant','tarte')),
 article text NOT NULL CHECK (length(trim(article)) BETWEEN 1 AND 120),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(pdv_id, category, article)
);
GRANT SELECT, INSERT, UPDATE ON public.weekly_article_settings TO authenticated;
GRANT ALL ON public.weekly_article_settings TO service_role;
ALTER TABLE public.weekly_article_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_articles_read ON public.weekly_article_settings FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY weekly_articles_insert ON public.weekly_article_settings FOR INSERT TO authenticated WITH CHECK (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY weekly_articles_update ON public.weekly_article_settings FOR UPDATE TO authenticated USING (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id)) WITH CHECK (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id));
COMMENT ON TABLE public.weekly_article_settings IS 'PDV weekly display additions and reversible removals; historical weekly rows and transfer identities are never modified.';