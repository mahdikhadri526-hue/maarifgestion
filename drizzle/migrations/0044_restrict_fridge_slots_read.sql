DROP POLICY IF EXISTS "fridge_slots read" ON public.fridge_slots;
CREATE POLICY "fridge_slots read" ON public.fridge_slots FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));