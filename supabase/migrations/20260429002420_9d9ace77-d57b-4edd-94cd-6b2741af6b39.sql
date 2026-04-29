CREATE OR REPLACE FUNCTION public.validate_autocontrol_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ingredient_count integer;
  incomplete_ingredient_count integer;
BEGIN
  IF length(trim(coalesce(NEW.fiche_type, ''))) = 0 THEN
    RAISE EXCEPTION 'Le type de fiche est obligatoire';
  END IF;

  IF length(trim(coalesce(NEW.control_date, ''))) = 0 THEN
    RAISE EXCEPTION 'La date est obligatoire';
  END IF;

  IF length(trim(coalesce(NEW.collaborateur, ''))) = 0 THEN
    RAISE EXCEPTION 'Le collaborateur est obligatoire';
  END IF;

  IF length(trim(coalesce(NEW.article, ''))) = 0 THEN
    RAISE EXCEPTION 'La désignation est obligatoire';
  END IF;

  IF length(trim(coalesce(NEW.lot_number, ''))) = 0 THEN
    RAISE EXCEPTION 'Le numéro de lot est obligatoire';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité est obligatoire';
  END IF;

  IF length(trim(coalesce(NEW.dlc, ''))) = 0 THEN
    RAISE EXCEPTION 'La DLC est obligatoire';
  END IF;

  IF length(trim(coalesce(NEW.notes, ''))) = 0 THEN
    RAISE EXCEPTION 'Les observations sont obligatoires';
  END IF;

  IF length(trim(coalesce(NEW.visa_manager, ''))) = 0 THEN
    RAISE EXCEPTION 'Le visa manager est obligatoire';
  END IF;

  IF length(NEW.fiche_type) > 120
    OR length(NEW.control_date) > 20
    OR length(NEW.collaborateur) > 100
    OR length(NEW.article) > 120
    OR length(coalesce(NEW.lot_number, '')) > 120
    OR length(coalesce(NEW.dlc, '')) > 20
    OR length(coalesce(NEW.visa_manager, '')) > 100
    OR length(coalesce(NEW.notes, '')) > 1000 THEN
    RAISE EXCEPTION 'Une valeur saisie est trop longue';
  END IF;

  IF NEW.fiche_type = 'Cornet/Tulipe/Gaufrette' THEN
    IF NEW.extra_data IS NULL OR jsonb_typeof(NEW.extra_data) <> 'object' THEN
      RAISE EXCEPTION 'Les détails Cornet/Tulipe/Gaufrette sont obligatoires';
    END IF;

    IF jsonb_typeof(NEW.extra_data->'ingredients') <> 'array' THEN
      RAISE EXCEPTION 'Les ingrédients sont obligatoires';
    END IF;

    SELECT count(*) INTO ingredient_count
    FROM jsonb_array_elements(NEW.extra_data->'ingredients') AS ingredient;

    SELECT count(*) INTO incomplete_ingredient_count
    FROM jsonb_array_elements(NEW.extra_data->'ingredients') AS ingredient
    WHERE length(trim(coalesce(ingredient->>'name', ''))) = 0
      OR length(trim(coalesce(ingredient->>'quantity', ''))) = 0
      OR length(trim(coalesce(ingredient->>'lot', ''))) = 0
      OR length(coalesce(ingredient->>'name', '')) > 80
      OR length(coalesce(ingredient->>'quantity', '')) > 80
      OR length(coalesce(ingredient->>'lot', '')) > 120;

    IF ingredient_count <> 7 OR incomplete_ingredient_count > 0 THEN
      RAISE EXCEPTION 'Tous les ingrédients doivent être remplis';
    END IF;

    IF coalesce((NEW.extra_data #>> '{cleaning,lavageMachine}')::boolean, false) IS NOT TRUE
      OR coalesce((NEW.extra_data #>> '{cleaning,lavageTorchons}')::boolean, false) IS NOT TRUE
      OR coalesce((NEW.extra_data #>> '{cleaning,desinfection}')::boolean, false) IS NOT TRUE
      OR coalesce((NEW.extra_data #>> '{cleaning,rangementUstensiles}')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Tous les contrôles de nettoyage doivent être cochés';
    END IF;

    IF coalesce((NEW.extra_data #>> '{managerControl,etiquettes}')::boolean, false) IS NOT TRUE
      OR coalesce((NEW.extra_data #>> '{managerControl,cuisson}')::boolean, false) IS NOT TRUE
      OR coalesce((NEW.extra_data #>> '{managerControl,forme}')::boolean, false) IS NOT TRUE
      OR coalesce((NEW.extra_data #>> '{managerControl,nettoyage}')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Tous les contrôles manager doivent être cochés';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_autocontrol_entry_before_save ON public.autocontrols;

CREATE TRIGGER validate_autocontrol_entry_before_save
BEFORE INSERT OR UPDATE ON public.autocontrols
FOR EACH ROW
EXECUTE FUNCTION public.validate_autocontrol_entry();