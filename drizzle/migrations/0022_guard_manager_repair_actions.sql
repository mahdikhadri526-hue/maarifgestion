CREATE OR REPLACE FUNCTION public.guard_manager_repair_actions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (OLD.processing_mode = 'manager' OR NEW.processing_mode = 'manager')
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.tech_validated_at IS DISTINCT FROM OLD.tech_validated_at
       OR NEW.tech_validated_by IS DISTINCT FROM OLD.tech_validated_by
       OR NEW.action_done IS DISTINCT FROM OLD.action_done
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.processing_mode IS DISTINCT FROM OLD.processing_mode
     ) THEN
    IF lower(coalesce(auth.jwt()->>'email', '')) = 'gestion-technique@oliveri.com'
       OR NOT public.has_role(auth.uid(), 'manager'::public.app_role)
       OR NOT public.can_access_pdv(auth.uid(), NEW.pdv_id)
       OR NOT (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')) THEN
      RAISE EXCEPTION 'Seul le manager du PDV peut prendre en charge et valider une réparation confiée au manager';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_manager_repair_actions
BEFORE UPDATE ON public.tech_issues
FOR EACH ROW EXECUTE FUNCTION public.guard_manager_repair_actions();