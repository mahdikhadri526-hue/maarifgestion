CREATE OR REPLACE FUNCTION public.guard_tech_deadline_extension()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.deadline IS NOT NULL AND NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    IF lower(coalesce(auth.jwt()->>'email', '')) <> 'gestion-technique@oliveri.com'
       OR NOT public.has_permission(auth.uid(), 'manage_tech') THEN
      RAISE EXCEPTION 'Seul le responsable technique peut rectifier le deadline';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_tech_deadline_extension() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.correct_tech_deadline(_issue_id uuid, _deadline date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_issue public.tech_issues%ROWTYPE;
BEGIN
  IF lower(coalesce(auth.jwt()->>'email', '')) <> 'gestion-technique@oliveri.com'
     OR NOT public.has_permission(auth.uid(), 'manage_tech') THEN
    RAISE EXCEPTION 'Seul le responsable technique peut rectifier le deadline';
  END IF;
  SELECT * INTO current_issue FROM public.tech_issues WHERE id = _issue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intervention introuvable ou inaccessible'; END IF;
  IF current_issue.deadline IS NULL THEN RAISE EXCEPTION 'Aucun deadline à rectifier'; END IF;
  IF _deadline IS NULL OR _deadline = current_issue.deadline THEN
    RAISE EXCEPTION 'Choisissez une nouvelle échéance';
  END IF;
  UPDATE public.tech_issues SET deadline = _deadline WHERE id = _issue_id;
END;
$$;
REVOKE ALL ON FUNCTION public.correct_tech_deadline(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_tech_deadline(uuid, date) TO authenticated;
CREATE OR REPLACE FUNCTION public.extend_tech_deadline(_issue_id uuid, _deadline date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  PERFORM public.correct_tech_deadline(_issue_id, _deadline);
END;
$$;