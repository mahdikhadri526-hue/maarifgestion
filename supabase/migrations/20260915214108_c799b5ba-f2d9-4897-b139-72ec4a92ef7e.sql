DROP POLICY IF EXISTS "planning_can_view_scheduled_agents" ON public.attendance_agents;

CREATE OR REPLACE FUNCTION public.is_agent_scheduled_for_user(_user_id uuid, _agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hr_schedules s
    WHERE s.agent_id = _agent_id
      AND public.can_access_pdv(_user_id, s.pdv_id)
  )
$$;

CREATE POLICY "planning_can_view_scheduled_agents"
ON public.attendance_agents
FOR SELECT
TO authenticated
USING (public.is_agent_scheduled_for_user(auth.uid(), id));