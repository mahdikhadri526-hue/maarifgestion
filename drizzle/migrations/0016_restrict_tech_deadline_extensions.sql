CREATE OR REPLACE FUNCTION public.guard_tech_deadline_extension()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.deadline IS NOT NULL AND NEW.deadline > OLD.deadline THEN
    IF lower(coalesce(auth.jwt()->>'email', '')) <> 'gestion-technique@oliveri.com'
       OR NOT public.has_permission(auth.uid(), 'manage_tech') THEN
      RAISE EXCEPTION 'Seul le responsable technique peut prolonger le deadline';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_tech_deadline_extension() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_tech_deadline_extension BEFORE UPDATE OF deadline ON public.tech_issues FOR EACH ROW EXECUTE FUNCTION public.guard_tech_deadline_extension();

CREATE OR REPLACE FUNCTION public.extend_tech_deadline(_issue_id uuid, _deadline date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_issue public.tech_issues%ROWTYPE;
BEGIN
  IF lower(coalesce(auth.jwt()->>'email', '')) <> 'gestion-technique@oliveri.com'
     OR NOT public.has_permission(auth.uid(), 'manage_tech') THEN
    RAISE EXCEPTION 'Seul le responsable technique peut prolonger le deadline';
  END IF;
  SELECT * INTO current_issue FROM public.tech_issues WHERE id = _issue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intervention introuvable ou inaccessible'; END IF;
  IF current_issue.deadline IS NULL OR current_issue.status NOT IN ('a_traiter', 'en_cours') THEN
    RAISE EXCEPTION 'Cette intervention ne peut pas être prolongée';
  END IF;
  IF _deadline IS NULL OR _deadline <= current_issue.deadline THEN
    RAISE EXCEPTION 'La nouvelle échéance doit être postérieure au deadline actuel';
  END IF;
  UPDATE public.tech_issues SET deadline = _deadline WHERE id = _issue_id;
END;
$$;
REVOKE ALL ON FUNCTION public.extend_tech_deadline(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extend_tech_deadline(uuid, date) TO authenticated;