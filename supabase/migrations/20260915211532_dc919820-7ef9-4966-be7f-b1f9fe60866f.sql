CREATE POLICY "planning_can_view_scheduled_agents"
ON public.attendance_agents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hr_schedules s
    WHERE s.agent_id = attendance_agents.id
      AND public.can_access_pdv(auth.uid(), s.pdv_id)
  )
);