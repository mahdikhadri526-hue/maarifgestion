CREATE TABLE public.voice_guide_texts (
  section_key text PRIMARY KEY,
  module_key text NOT NULL,
  section_title text NOT NULL,
  script text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_guide_texts TO authenticated;
GRANT ALL ON public.voice_guide_texts TO service_role;
ALTER TABLE public.voice_guide_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read voice texts" ON public.voice_guide_texts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert voice texts" ON public.voice_guide_texts FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update voice texts" ON public.voice_guide_texts FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete voice texts" ON public.voice_guide_texts FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER update_voice_guide_texts_updated_at BEFORE UPDATE ON public.voice_guide_texts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();