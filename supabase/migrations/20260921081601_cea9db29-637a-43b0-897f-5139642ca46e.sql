DROP POLICY "auth insert glace stuff" ON public.glace_stuff_controls;
CREATE POLICY "auth insert glace stuff" ON public.glace_stuff_controls
FOR INSERT TO authenticated
WITH CHECK ((SELECT has_permission(auth.uid(), 'edit_autocontrol'::text)));