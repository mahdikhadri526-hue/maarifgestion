CREATE TABLE public.weekly_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 pdv_id uuid NOT NULL REFERENCES public.pdvs(id),
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
 articles jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(articles) = 'array'),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.weekly_followups TO authenticated;
GRANT ALL ON public.weekly_followups TO service_role;
ALTER TABLE public.weekly_followups ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX weekly_followups_name_per_pdv ON public.weekly_followups(pdv_id, lower(trim(name)));
CREATE POLICY weekly_followups_read ON public.weekly_followups FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY weekly_followups_insert ON public.weekly_followups FOR INSERT TO authenticated WITH CHECK (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY weekly_followups_update ON public.weekly_followups FOR UPDATE TO authenticated USING (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id)) WITH CHECK (public.can_manage_shared_catalog() AND public.can_access_pdv(auth.uid(), pdv_id));
CREATE TRIGGER weekly_followups_updated BEFORE UPDATE ON public.weekly_followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();