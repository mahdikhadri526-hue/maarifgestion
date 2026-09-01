-- Les validations restent en BEFORE, mais l'écriture de l'historique passe en AFTER
-- (sinon l'événement référence un dossier pas encore inséré → erreur de clé étrangère).
DROP TRIGGER IF EXISTS trg_tech_issues_audit ON public.tech_issues;

CREATE OR REPLACE FUNCTION public.tech_issues_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'cloture' AND OLD.status IS DISTINCT FROM 'cloture' THEN
    IF NEW.tech_validated_at IS NULL OR NEW.manager_validated_at IS NULL THEN
      RAISE EXCEPTION 'Clôture impossible : validation du responsable technique et du manager requises';
    END IF;
  END IF;
  IF NEW.tech_validated_at IS NOT NULL AND OLD.tech_validated_at IS NULL THEN
    IF coalesce(trim(NEW.action_done), '') = '' OR coalesce(trim(NEW.tech_validated_by), '') = '' THEN
      RAISE EXCEPTION 'Validation technique : action réalisée et nom du responsable obligatoires';
    END IF;
    IF NEW.repaired_at IS NULL THEN NEW.repaired_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tech_issues_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tech_issue_events (pdv_id, issue_id, event_type, actor_name, actor_user, details)
    VALUES (NEW.pdv_id, NEW.id, 'signale', NEW.reported_by, auth.uid(),
            jsonb_build_object('priority', NEW.priority, 'problem', NEW.problem));
    RETURN NEW;
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
$function$;

CREATE TRIGGER trg_tech_issues_validate
BEFORE INSERT OR UPDATE ON public.tech_issues
FOR EACH ROW EXECUTE FUNCTION public.tech_issues_validate();

CREATE TRIGGER trg_tech_issues_audit
AFTER INSERT OR UPDATE ON public.tech_issues
FOR EACH ROW EXECUTE FUNCTION public.tech_issues_audit();

REVOKE EXECUTE ON FUNCTION public.tech_issues_validate() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tech_issues_audit() FROM public, anon, authenticated;