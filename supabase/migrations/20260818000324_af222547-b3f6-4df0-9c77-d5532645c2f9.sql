CREATE TABLE public.ecart_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  section text NOT NULL,
  item text NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, entry_date, section, item)
);

CREATE INDEX idx_ecart_lines_pdv_date ON public.ecart_lines (pdv_id, entry_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecart_lines TO authenticated;
GRANT ALL ON public.ecart_lines TO service_role;

ALTER TABLE public.ecart_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecart_lines_select" ON public.ecart_lines
FOR SELECT TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'view_ecarts') OR public.is_admin(auth.uid()) OR public.is_regional_admin(auth.uid())));

CREATE POLICY "ecart_lines_insert" ON public.ecart_lines
FOR INSERT TO authenticated
WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'edit_ecarts') OR public.is_admin(auth.uid()) OR public.is_regional_admin(auth.uid())));

CREATE POLICY "ecart_lines_update" ON public.ecart_lines
FOR UPDATE TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'edit_ecarts') OR public.is_admin(auth.uid()) OR public.is_regional_admin(auth.uid())))
WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND (public.has_permission(auth.uid(), 'edit_ecarts') OR public.is_admin(auth.uid()) OR public.is_regional_admin(auth.uid())));

CREATE POLICY "ecart_lines_delete" ON public.ecart_lines
FOR DELETE TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.is_admin(auth.uid()) OR public.is_regional_admin(auth.uid())));

CREATE TRIGGER trg_ecart_lines_updated_at
BEFORE UPDATE ON public.ecart_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();