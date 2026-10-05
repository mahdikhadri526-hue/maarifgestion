CREATE TABLE public.voice_training_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  text text NOT NULL DEFAULT '',
  target_label text NOT NULL DEFAULT '',
  audio_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_training_steps TO authenticated;
GRANT ALL ON public.voice_training_steps TO service_role;
ALTER TABLE public.voice_training_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitted users can view training steps" ON public.voice_training_steps FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'listen_voice_guides'));
CREATE POLICY "Admins manage training steps" ON public.voice_training_steps FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX voice_training_steps_module_idx ON public.voice_training_steps(module_key, position);