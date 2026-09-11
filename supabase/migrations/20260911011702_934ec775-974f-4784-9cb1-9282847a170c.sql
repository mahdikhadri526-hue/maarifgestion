ALTER TABLE public.attendance_agents
  ADD COLUMN IF NOT EXISTS poste text,
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS staff_level text NOT NULL DEFAULT 'agent';

CREATE TABLE IF NOT EXISTS public.hr_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.attendance_agents(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  day_type text NOT NULL DEFAULT 'travail',
  start_time text,
  end_time text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, work_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_schedules TO authenticated;
GRANT ALL ON public.hr_schedules TO service_role;
ALTER TABLE public.hr_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_schedules_select" ON public.hr_schedules FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.has_permission(auth.uid(), 'manage_hr'));
CREATE POLICY "hr_schedules_insert" ON public.hr_schedules FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) OR public.has_permission(auth.uid(), 'manage_hr'));
CREATE POLICY "hr_schedules_update" ON public.hr_schedules FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.has_permission(auth.uid(), 'manage_hr'));
CREATE POLICY "hr_schedules_delete" ON public.hr_schedules FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.has_permission(auth.uid(), 'manage_hr'));

CREATE TRIGGER update_hr_schedules_updated_at BEFORE UPDATE ON public.hr_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.hr_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_holidays TO authenticated;
GRANT ALL ON public.hr_holidays TO service_role;
ALTER TABLE public.hr_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_holidays_select" ON public.hr_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_holidays_insert" ON public.hr_holidays FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'manage_hr') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_holidays_update" ON public.hr_holidays FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_hr') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_holidays_delete" ON public.hr_holidays FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_hr') OR public.is_admin(auth.uid()));

CREATE TRIGGER update_hr_holidays_updated_at BEFORE UPDATE ON public.hr_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.hr_balance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.attendance_agents(id) ON DELETE CASCADE,
  kind text NOT NULL,
  days numeric NOT NULL DEFAULT 0,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_balance_entries TO authenticated;
GRANT ALL ON public.hr_balance_entries TO service_role;
ALTER TABLE public.hr_balance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_balance_select" ON public.hr_balance_entries FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.has_permission(auth.uid(), 'manage_hr'));
CREATE POLICY "hr_balance_insert" ON public.hr_balance_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) OR public.has_permission(auth.uid(), 'manage_hr'));
CREATE POLICY "hr_balance_update" ON public.hr_balance_entries FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.has_permission(auth.uid(), 'manage_hr'));
CREATE POLICY "hr_balance_delete" ON public.hr_balance_entries FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.has_permission(auth.uid(), 'manage_hr'));

CREATE TRIGGER update_hr_balance_updated_at BEFORE UPDATE ON public.hr_balance_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS hr_schedules_pdv_date_idx ON public.hr_schedules (pdv_id, work_date);
CREATE INDEX IF NOT EXISTS hr_balance_agent_idx ON public.hr_balance_entries (agent_id);