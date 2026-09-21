REVOKE SELECT ON public.pdvs FROM authenticated;
REVOKE SELECT ON public.pdvs FROM anon;
GRANT SELECT (id, code, name, active, created_at, updated_at, default_role) ON public.pdvs TO authenticated;
GRANT ALL ON public.pdvs TO service_role;