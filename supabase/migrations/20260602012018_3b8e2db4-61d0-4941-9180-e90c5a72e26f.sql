CREATE TABLE public.glace_grammage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article TEXT NOT NULL UNIQUE,
  grammage_grams INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.glace_grammage TO authenticated;
GRANT ALL ON public.glace_grammage TO service_role;

ALTER TABLE public.glace_grammage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select glace_grammage" ON public.glace_grammage
  FOR SELECT USING (has_permission(auth.uid(), 'view_weekly'));
CREATE POLICY "auth insert glace_grammage" ON public.glace_grammage
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'edit_weekly'));
CREATE POLICY "auth update glace_grammage" ON public.glace_grammage
  FOR UPDATE USING (has_permission(auth.uid(), 'edit_weekly'));
CREATE POLICY "auth delete glace_grammage" ON public.glace_grammage
  FOR DELETE USING (has_permission(auth.uid(), 'edit_weekly'));

CREATE TRIGGER update_glace_grammage_updated_at
  BEFORE UPDATE ON public.glace_grammage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
