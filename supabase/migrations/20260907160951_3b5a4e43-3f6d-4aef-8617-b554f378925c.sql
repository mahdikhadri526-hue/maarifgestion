CREATE TABLE public.attendance_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  descriptors jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX attendance_agents_pdv_name_idx ON public.attendance_agents (pdv_id, lower(full_name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_agents TO authenticated;
GRANT ALL ON public.attendance_agents TO service_role;

ALTER TABLE public.attendance_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_agents_select" ON public.attendance_agents
  FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id)
     AND (public.has_permission(auth.uid(), 'view_attendance') OR public.has_permission(auth.uid(), 'manage_attendance')));

CREATE POLICY "attendance_agents_insert" ON public.attendance_agents
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_attendance'));

CREATE POLICY "attendance_agents_update" ON public.attendance_agents
  FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_attendance'))
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_attendance'));

CREATE POLICY "attendance_agents_delete" ON public.attendance_agents
  FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_attendance'));

CREATE TRIGGER trg_attendance_agents_updated_at
  BEFORE UPDATE ON public.attendance_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.attendance_punches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.attendance_agents(id) ON DELETE SET NULL,
  agent_name text NOT NULL,
  punch_type text NOT NULL,
  punched_at timestamp with time zone NOT NULL DEFAULT now(),
  punch_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  match_score numeric,
  method text NOT NULL DEFAULT 'face',
  device_label text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX attendance_punches_pdv_date_idx ON public.attendance_punches (pdv_id, punch_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_punches TO authenticated;
GRANT ALL ON public.attendance_punches TO service_role;

ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_punches_select" ON public.attendance_punches
  FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id)
     AND (public.has_permission(auth.uid(), 'view_attendance') OR public.has_permission(auth.uid(), 'manage_attendance')));

CREATE POLICY "attendance_punches_insert" ON public.attendance_punches
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id)
     AND (public.has_permission(auth.uid(), 'view_attendance') OR public.has_permission(auth.uid(), 'manage_attendance')));

CREATE POLICY "attendance_punches_update" ON public.attendance_punches
  FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_attendance'))
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_attendance'));

CREATE POLICY "attendance_punches_delete" ON public.attendance_punches
  FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_attendance'));

CREATE TRIGGER trg_attendance_punches_updated_at
  BEFORE UPDATE ON public.attendance_punches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();