CREATE TABLE public.roster_names (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('operator','manager')),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX roster_names_unique ON public.roster_names (pdv_id, kind, lower(name));
CREATE INDEX roster_names_pdv_idx ON public.roster_names (pdv_id, kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_names TO authenticated;
GRANT ALL ON public.roster_names TO service_role;

ALTER TABLE public.roster_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roster_names_select" ON public.roster_names
  FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "roster_names_insert" ON public.roster_names
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_roster'))
  );

CREATE POLICY "roster_names_update" ON public.roster_names
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_roster'))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_roster'))
  );

CREATE POLICY "roster_names_delete" ON public.roster_names
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_roster'))
  );

CREATE TRIGGER trg_roster_names_updated_at
  BEFORE UPDATE ON public.roster_names
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();