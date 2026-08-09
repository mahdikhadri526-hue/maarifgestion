CREATE TABLE public.glace_stuff_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  control_date text NOT NULL,
  zone text NOT NULL DEFAULT 'Salle',
  slot text NOT NULL,
  line_index integer NOT NULL DEFAULT 0,
  non_conformite boolean,
  parfum text,
  lot_number text,
  anomalie text,
  plastique boolean,
  action_corrective text,
  visa_manager text,
  collaborateur text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, control_date, zone, slot, line_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.glace_stuff_controls TO authenticated;
GRANT ALL ON public.glace_stuff_controls TO service_role;

ALTER TABLE public.glace_stuff_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdv isolation" ON public.glace_stuff_controls
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (can_access_pdv(auth.uid(), pdv_id))
  WITH CHECK (can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "auth select glace stuff" ON public.glace_stuff_controls
  FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'view_autocontrol'));

CREATE POLICY "auth insert glace stuff" ON public.glace_stuff_controls
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth update glace stuff" ON public.glace_stuff_controls
  FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'edit_autocontrol'));

CREATE POLICY "auth delete glace stuff" ON public.glace_stuff_controls
  FOR DELETE TO authenticated USING (has_permission(auth.uid(), 'delete_autocontrol'));

CREATE TRIGGER update_glace_stuff_controls_updated_at
  BEFORE UPDATE ON public.glace_stuff_controls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();