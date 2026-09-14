CREATE TABLE public.pdv_shift_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  shift text NOT NULL CHECK (shift IN ('matin','apres_midi')),
  start_time text NOT NULL,
  end_time text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, shift)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_shift_times TO authenticated;
GRANT ALL ON public.pdv_shift_times TO service_role;

ALTER TABLE public.pdv_shift_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_times_select" ON public.pdv_shift_times
FOR SELECT TO authenticated USING (true);

CREATE POLICY "shift_times_insert" ON public.pdv_shift_times
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_hr'));

CREATE POLICY "shift_times_update" ON public.pdv_shift_times
FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_hr'))
WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_hr'));

CREATE POLICY "shift_times_delete" ON public.pdv_shift_times
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_hr'));

CREATE TRIGGER update_pdv_shift_times_updated_at
BEFORE UPDATE ON public.pdv_shift_times
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();