-- ============ AGENDA PEP ============

CREATE TABLE public.pep_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  name text NOT NULL,
  equipment text,
  frequency text NOT NULL,
  responsable text,
  category text,
  weekend_allowed boolean NOT NULL DEFAULT false,
  requires_photo boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  start_date date NOT NULL DEFAULT current_date,
  next_due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pep_tasks TO authenticated;
GRANT ALL ON public.pep_tasks TO service_role;
ALTER TABLE public.pep_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pep_tasks_select" ON public.pep_tasks FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')));
CREATE POLICY "pep_tasks_insert" ON public.pep_tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'));
CREATE POLICY "pep_tasks_update" ON public.pep_tasks FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'))
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'));
CREATE POLICY "pep_tasks_delete" ON public.pep_tasks FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'));
CREATE TRIGGER trg_pep_tasks_updated_at BEFORE UPDATE ON public.pep_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pep_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, holiday_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pep_holidays TO authenticated;
GRANT ALL ON public.pep_holidays TO service_role;
ALTER TABLE public.pep_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pep_holidays_select" ON public.pep_holidays FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "pep_holidays_insert" ON public.pep_holidays FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'));
CREATE POLICY "pep_holidays_update" ON public.pep_holidays FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'))
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'));
CREATE POLICY "pep_holidays_delete" ON public.pep_holidays FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'));
CREATE TRIGGER trg_pep_holidays_updated_at BEFORE UPDATE ON public.pep_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pep_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.pep_tasks(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  original_due_date date NOT NULL,
  status text NOT NULL DEFAULT 'todo',
  completed_at timestamptz,
  completed_by uuid,
  completed_by_name text,
  comment text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, original_due_date)
);
CREATE INDEX idx_pep_occurrences_pdv_due ON public.pep_occurrences (pdv_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pep_occurrences TO authenticated;
GRANT ALL ON public.pep_occurrences TO service_role;
ALTER TABLE public.pep_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pep_occ_select" ON public.pep_occurrences FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')));
CREATE POLICY "pep_occ_insert" ON public.pep_occurrences FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')));
CREATE POLICY "pep_occ_update" ON public.pep_occurrences FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')))
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')));
CREATE POLICY "pep_occ_delete" ON public.pep_occurrences FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'));
CREATE TRIGGER trg_pep_occurrences_updated_at BEFORE UPDATE ON public.pep_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pep_postponements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  occurrence_id uuid NOT NULL REFERENCES public.pep_occurrences(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.pep_tasks(id) ON DELETE CASCADE,
  from_date date NOT NULL,
  to_date date NOT NULL,
  reason text,
  postponed_by uuid,
  postponed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pep_postponements_occ ON public.pep_postponements (occurrence_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pep_postponements TO authenticated;
GRANT ALL ON public.pep_postponements TO service_role;
ALTER TABLE public.pep_postponements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pep_post_select" ON public.pep_postponements FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')));
CREATE POLICY "pep_post_insert" ON public.pep_postponements FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')));
CREATE POLICY "pep_post_delete" ON public.pep_postponements FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_pep'));