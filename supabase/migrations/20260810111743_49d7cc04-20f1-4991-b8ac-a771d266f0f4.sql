CREATE TABLE public.fridge_equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  zone text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (pdv_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fridge_equipments TO authenticated;
GRANT ALL ON public.fridge_equipments TO service_role;

ALTER TABLE public.fridge_equipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fridge_equipments_select" ON public.fridge_equipments
FOR SELECT TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'view_equipments') OR public.has_permission(auth.uid(), 'view_temperatures')));

CREATE POLICY "fridge_equipments_insert" ON public.fridge_equipments
FOR INSERT TO authenticated
WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_equipments')));

CREATE POLICY "fridge_equipments_update" ON public.fridge_equipments
FOR UPDATE TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_equipments')))
WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_equipments')));

CREATE POLICY "fridge_equipments_delete" ON public.fridge_equipments
FOR DELETE TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id) AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'delete_equipments')));

CREATE TRIGGER trg_fridge_equipments_updated_at
BEFORE UPDATE ON public.fridge_equipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();