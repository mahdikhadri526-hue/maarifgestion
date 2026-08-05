ALTER TABLE public.pdvs ADD COLUMN IF NOT EXISTS default_role public.app_role NOT NULL DEFAULT 'operator';

CREATE TABLE public.pdv_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, permission_key)
);

GRANT SELECT ON public.pdv_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pdv_permissions TO authenticated;
GRANT ALL ON public.pdv_permissions TO service_role;

ALTER TABLE public.pdv_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdv_permissions select authenticated" ON public.pdv_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pdv_permissions insert admin" ON public.pdv_permissions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "pdv_permissions update admin" ON public.pdv_permissions
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "pdv_permissions delete admin" ON public.pdv_permissions
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_pdv_permissions_updated_at
  BEFORE UPDATE ON public.pdv_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pdv_permissions_pdv ON public.pdv_permissions(pdv_id);