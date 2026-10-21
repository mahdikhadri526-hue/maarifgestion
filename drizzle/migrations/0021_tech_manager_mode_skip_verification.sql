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
    -- Dossiers confiés au manager du PDV : pas d'étape de vérification manager,
    -- la validation de la réparation clôture directement le dossier.
    IF NEW.processing_mode = 'manager' THEN
      IF NEW.tech_validated_at IS NULL THEN
        RAISE EXCEPTION 'Clôture impossible : validation de la réparation requise';
      END IF;
    ELSIF NEW.tech_validated_at IS NULL OR NEW.manager_validated_at IS NULL THEN
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