CREATE TABLE public.voice_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  section_title text NOT NULL,
  audio_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'audio/webm',
  duration_seconds integer,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_guides TO authenticated;
GRANT ALL ON public.voice_guides TO service_role;

ALTER TABLE public.voice_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view voice guides"
ON public.voice_guides FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can create voice guides"
ON public.voice_guides FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Admins can update voice guides"
ON public.voice_guides FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Admins can delete voice guides"
ON public.voice_guides FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_voice_guides_updated_at
BEFORE UPDATE ON public.voice_guides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can listen to voice guides"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'voice-guides');

CREATE POLICY "Admins can upload voice guides"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'voice-guides' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can replace voice guides"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'voice-guides' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'voice-guides' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can remove voice guides"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'voice-guides' AND public.is_admin(auth.uid()));