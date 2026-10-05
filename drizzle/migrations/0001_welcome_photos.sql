CREATE TABLE public.welcome_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.welcome_photos TO authenticated;
GRANT ALL ON public.welcome_photos TO service_role;
ALTER TABLE public.welcome_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can see welcome photos" ON public.welcome_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Main admin can add welcome photos" ON public.welcome_photos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND (auth.jwt() ->> 'email') = 'gestionmaarif1@gmail.com');
CREATE POLICY "Main admin can reorder welcome photos" ON public.welcome_photos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND (auth.jwt() ->> 'email') = 'gestionmaarif1@gmail.com') WITH CHECK (public.has_role(auth.uid(), 'admin') AND (auth.jwt() ->> 'email') = 'gestionmaarif1@gmail.com');
CREATE POLICY "Main admin can delete welcome photos" ON public.welcome_photos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND (auth.jwt() ->> 'email') = 'gestionmaarif1@gmail.com');
CREATE POLICY "Signed in users can read welcome images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'welcome-photos');
CREATE POLICY "Main admin can upload welcome images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'welcome-photos' AND public.has_role(auth.uid(), 'admin') AND (auth.jwt() ->> 'email') = 'gestionmaarif1@gmail.com');
CREATE POLICY "Main admin can remove welcome images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'welcome-photos' AND public.has_role(auth.uid(), 'admin') AND (auth.jwt() ->> 'email') = 'gestionmaarif1@gmail.com');