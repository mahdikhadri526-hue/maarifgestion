ALTER TABLE public.attendance_agents ADD COLUMN IF NOT EXISTS multi_pdv boolean NOT NULL DEFAULT false;
ALTER TABLE public.planning ADD COLUMN IF NOT EXISTS multi_pdv boolean NOT NULL DEFAULT false;

-- Agents multi-PDV visibles depuis tous les PDV
DROP POLICY attendance_agents_select ON public.attendance_agents;
CREATE POLICY attendance_agents_select ON public.attendance_agents FOR SELECT TO authenticated
  USING (
    (can_access_pdv(auth.uid(), pdv_id) OR multi_pdv = true)
    AND (has_permission(auth.uid(), 'view_attendance') OR has_permission(auth.uid(), 'manage_attendance') OR has_permission(auth.uid(), 'view_hr') OR has_permission(auth.uid(), 'manage_hr'))
  );

-- Lignes planning multi-PDV visibles depuis tous les PDV
DROP POLICY planning_select ON public.planning;
CREATE POLICY planning_select ON public.planning FOR SELECT TO authenticated
  USING (can_access_pdv(auth.uid(), pdv_id) OR multi_pdv = true);

-- Plannings hebdo des agents multi-PDV accessibles depuis tous les PDV
DROP POLICY hr_schedules_select ON public.hr_schedules;
CREATE POLICY hr_schedules_select ON public.hr_schedules FOR SELECT TO authenticated
  USING (
    can_access_pdv(auth.uid(), pdv_id)
    OR has_permission(auth.uid(), 'manage_hr')
    OR EXISTS (SELECT 1 FROM public.attendance_agents a WHERE a.id = agent_id AND a.multi_pdv = true)
  );

DROP POLICY hr_schedules_insert ON public.hr_schedules;
CREATE POLICY hr_schedules_insert ON public.hr_schedules FOR INSERT TO authenticated
  WITH CHECK (
    can_access_pdv(auth.uid(), pdv_id)
    OR has_permission(auth.uid(), 'manage_hr')
    OR EXISTS (SELECT 1 FROM public.attendance_agents a WHERE a.id = agent_id AND a.multi_pdv = true)
  );

DROP POLICY hr_schedules_update ON public.hr_schedules;
CREATE POLICY hr_schedules_update ON public.hr_schedules FOR UPDATE TO authenticated
  USING (
    can_access_pdv(auth.uid(), pdv_id)
    OR has_permission(auth.uid(), 'manage_hr')
    OR EXISTS (SELECT 1 FROM public.attendance_agents a WHERE a.id = agent_id AND a.multi_pdv = true)
  );

DROP POLICY hr_schedules_delete ON public.hr_schedules;
CREATE POLICY hr_schedules_delete ON public.hr_schedules FOR DELETE TO authenticated
  USING (
    can_access_pdv(auth.uid(), pdv_id)
    OR has_permission(auth.uid(), 'manage_hr')
    OR EXISTS (SELECT 1 FROM public.attendance_agents a WHERE a.id = agent_id AND a.multi_pdv = true)
  );