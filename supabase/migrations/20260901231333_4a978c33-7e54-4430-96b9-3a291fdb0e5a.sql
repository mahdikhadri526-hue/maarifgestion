ALTER TABLE public.tech_issues
  ADD COLUMN IF NOT EXISTS repair_photo_url text,
  ADD COLUMN IF NOT EXISTS action_done text,
  ADD COLUMN IF NOT EXISTS tech_comment text,
  ADD COLUMN IF NOT EXISTS tech_validated_by text,
  ADD COLUMN IF NOT EXISTS tech_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_validated_by text,
  ADD COLUMN IF NOT EXISTS manager_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_comment text;

CREATE TABLE IF NOT EXISTS public.tech_issue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.tech_issues(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_name text,
  actor_user uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tech_issue_events_issue_idx ON public.tech_issue_events(issue_id, created_at);
CREATE INDEX IF NOT EXISTS tech_issue_events_pdv_idx ON public.tech_issue_events(pdv_id, created_at);

GRANT SELECT ON public.tech_issue_events TO authenticated;
GRANT ALL ON public.tech_issue_events TO service_role;

ALTER TABLE public.tech_issue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_issue_events_select ON public.tech_issue_events
  FOR SELECT TO authenticated
  USING (
    public.can_access_pdv(auth.uid(), pdv_id)
    AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')
         OR public.has_permission(auth.uid(), 'manage_tech') OR public.has_permission(auth.uid(), 'view_tech'))
  );

-- Historique automatique + règles de clôture
CREATE OR REPLACE FUNCTION public.tech_issues_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (NEW.pdv_id, NEW.id, 'signale', NEW.reported_by, auth.uid(),
            jsonb_build_object('priority', NEW.priority, 'problem', NEW.problem));
    RETURN NEW;
  END IF;

  -- Clôture uniquement après les deux validations
  IF NEW.status = 'cloture' AND OLD.status IS DISTINCT FROM 'cloture' THEN
    IF NEW.tech_validated_at IS NULL OR NEW.manager_validated_at IS NULL THEN
      RAISE EXCEPTION 'Clôture impossible : validation du responsable technique et du manager requises';
    END IF;
  END IF;
  -- Validation technique impossible sans réparation renseignée
  IF NEW.tech_validated_at IS NOT NULL AND OLD.tech_validated_at IS NULL THEN
    IF coalesce(trim(NEW.action_done), '') = '' OR coalesce(trim(NEW.tech_validated_by), '') = '' THEN
      RAISE EXCEPTION 'Validation technique : action réalisée et nom du responsable obligatoires';
    END IF;
    IF NEW.repaired_at IS NULL THEN NEW.repaired_at := now(); END IF;
  END IF;

  actor := coalesce(NEW.assigned_to, NEW.reported_by);

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (NEW.pdv_id, NEW.id, 'statut', actor, auth.uid(),
            jsonb_build_object('from', OLD.status, 'to', NEW.status, 'deadline', NEW.deadline));
  END IF;
  IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (NEW.pdv_id, NEW.id, 'deadline', actor, auth.uid(),
            jsonb_build_object('from', OLD.deadline, 'to', NEW.deadline));
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (NEW.pdv_id, NEW.id, 'responsable', actor, auth.uid(),
            jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (NEW.pdv_id, NEW.id, 'priorite', actor, auth.uid(),
            jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
  END IF;
  IF NEW.tech_validated_at IS NOT NULL AND OLD.tech_validated_at IS NULL THEN
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (NEW.pdv_id, NEW.id, 'validation_tech', NEW.tech_validated_by, auth.uid(),
            jsonb_build_object('action', NEW.action_done, 'comment', NEW.tech_comment,
                               'late', (NEW.deadline IS NOT NULL AND NEW.tech_validated_at::date > NEW.deadline)));
  END IF;
  IF NEW.manager_validated_at IS NOT NULL AND OLD.manager_validated_at IS NULL THEN
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (NEW.pdv_id, NEW.id, 'validation_manager', NEW.manager_validated_by, auth.uid(),
            jsonb_build_object('comment', NEW.manager_comment));
  END IF;
  IF (NEW.tech_notes IS DISTINCT FROM OLD.tech_notes) OR (NEW.tech_comment IS DISTINCT FROM OLD.tech_comment) THEN
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (NEW.pdv_id, NEW.id, 'note', actor, auth.uid(),
            jsonb_build_object('tech_notes', NEW.tech_notes, 'tech_comment', NEW.tech_comment));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tech_issues_audit ON public.tech_issues;
CREATE TRIGGER trg_tech_issues_audit
  BEFORE INSERT OR UPDATE ON public.tech_issues
  FOR EACH ROW EXECUTE FUNCTION public.tech_issues_audit();

-- Validation du manager (sans droit d'édition général sur la table)
CREATE OR REPLACE FUNCTION public.tech_manager_validate(_issue_id uuid, _manager_name text, _comment text DEFAULT NULL, _ok boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  i public.tech_issues%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.tech_issues WHERE id = _issue_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Signalement introuvable'; END IF;
  IF NOT public.can_access_pdv(auth.uid(), i.pdv_id)
     OR NOT (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep') OR public.has_permission(auth.uid(), 'manage_tech')) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF coalesce(trim(_manager_name), '') = '' THEN RAISE EXCEPTION 'Nom du manager obligatoire'; END IF;
  IF i.tech_validated_at IS NULL THEN RAISE EXCEPTION 'Le responsable technique doit d''abord valider la réparation'; END IF;

  IF _ok THEN
    UPDATE public.tech_issues
      SET manager_validated_by = trim(_manager_name), manager_validated_at = now(), manager_comment = nullif(trim(coalesce(_comment,'')), ''),
          status = 'cloture', closed_at = now()
      WHERE id = _issue_id;
  ELSE
    -- Refus : le matériel ne fonctionne pas, retour en cours
    UPDATE public.tech_issues
      SET tech_validated_at = NULL, tech_validated_by = NULL, repaired_at = NULL,
          manager_validated_at = NULL, manager_validated_by = NULL,
          manager_comment = nullif(trim(coalesce(_comment,'')), ''),
          status = 'en_cours'
      WHERE id = _issue_id;
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (i.pdv_id, _issue_id, 'refus_manager', trim(_manager_name), auth.uid(), jsonb_build_object('comment', _comment));
  END IF;
END;
$$;