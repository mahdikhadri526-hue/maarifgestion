DROP POLICY IF EXISTS "auth insert glace_grammage" ON public.glace_grammage;
DROP POLICY IF EXISTS "auth update glace_grammage" ON public.glace_grammage;
DROP POLICY IF EXISTS "auth delete glace_grammage" ON public.glace_grammage;
CREATE POLICY "admin insert glace_grammage" ON public.glace_grammage FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin update glace_grammage" ON public.glace_grammage FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin delete glace_grammage" ON public.glace_grammage FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));