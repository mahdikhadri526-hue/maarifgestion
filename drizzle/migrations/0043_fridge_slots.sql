CREATE TABLE public.fridge_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  hour integer NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute integer NOT NULL DEFAULT 0 CHECK (minute >= 0 AND minute <= 59),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fridge_slots TO authenticated;
GRANT ALL ON public.fridge_slots TO service_role;
ALTER TABLE public.fridge_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fridge_slots read" ON public.fridge_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "fridge_slots admin insert" ON public.fridge_slots FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "fridge_slots admin update" ON public.fridge_slots FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "fridge_slots admin delete" ON public.fridge_slots FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER fridge_slots_updated BEFORE UPDATE ON public.fridge_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.fridge_slots (label, hour, sort_order) VALUES ('07h',7,1),('16h',16,2),('00h',0,3);