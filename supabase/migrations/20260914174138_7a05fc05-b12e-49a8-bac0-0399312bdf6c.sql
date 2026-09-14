CREATE TABLE public.planning (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.attendance_agents(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  poste text,
  staff_level text NOT NULL DEFAULT 'agent',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, agent_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning TO authenticated;
GRANT ALL ON public.planning TO service_role;
ALTER TABLE public.planning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planning_select" ON public.planning FOR SELECT TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "planning_insert" ON public.planning FOR INSERT TO authenticated WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "planning_update" ON public.planning FOR UPDATE TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "planning_delete" ON public.planning FOR DELETE TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));
CREATE TRIGGER update_planning_updated_at BEFORE UPDATE ON public.planning FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();