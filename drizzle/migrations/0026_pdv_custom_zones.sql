CREATE TABLE public.pdv_custom_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cleaning','fridge')),
  zone_key text NOT NULL,
  label text NOT NULL,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, kind, zone_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_custom_zones TO authenticated;
GRANT ALL ON public.pdv_custom_zones TO service_role;
ALTER TABLE public.pdv_custom_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom zones select" ON public.pdv_custom_zones FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.is_regional_admin(auth.uid()));
CREATE POLICY "custom zones insert" ON public.pdv_custom_zones FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR (public.is_regional_admin(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id)));
CREATE POLICY "custom zones update" ON public.pdv_custom_zones FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.is_regional_admin(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id)))
  WITH CHECK (public.is_admin(auth.uid()) OR (public.is_regional_admin(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id)));
CREATE POLICY "custom zones delete" ON public.pdv_custom_zones FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.is_regional_admin(auth.uid()) AND public.can_access_pdv(auth.uid(), pdv_id)));
CREATE TRIGGER pdv_custom_zones_updated BEFORE UPDATE ON public.pdv_custom_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();