CREATE OR REPLACE FUNCTION public.validate_autocontrol_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  ingredient_count integer;
  incomplete_ingredient_count integer;
  panache_mat_count integer;
  panache_mat_incomplete integer;
  has_visa boolean;
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

  IF NEW.fiche_type <> 'Panaché' AND length(trim(coalesce(NEW.article, ''))) = 0 THEN
    RAISE EXCEPTION 'La désignation est obligatoire';
  END IF;

  IF length(trim(coalesce(NEW.lot_number, ''))) = 0 THEN
    RAISE EXCEPTION 'Le numéro de lot est obligatoire';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité est obligatoire';
  END IF;

  IF NEW.fiche_type <> 'Décoration' AND length(trim(coalesce(NEW.dlc, ''))) = 0 THEN
    RAISE EXCEPTION 'La DLC est obligatoire';
  END IF;

  has_visa := length(trim(coalesce(NEW.visa_manager, ''))) > 0;

  IF length(NEW.fiche_type) > 120
    OR length(NEW.control_date) > 20
    OR length(NEW.collaborateur) > 100
    OR length(coalesce(NEW.article, '')) > 120
    OR length(coalesce(NEW.lot_number, '')) > 500
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

    IF has_visa THEN
      IF coalesce((NEW.extra_data #>> '{cleaning,lavageMachine}')::boolean, false) IS NOT TRUE
        OR coalesce((NEW.extra_data #>> '{cleaning,lavageTorchons}')::boolean, false) IS NOT TRUE
        OR coalesce((NEW.extra_data #>> '{cleaning,desinfection}')::boolean, false) IS NOT TRUE
        OR coalesce((NEW.extra_data #>> '{cleaning,rangementUstensiles}')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Tous les contrôles de nettoyage doivent être cochés Fait';
      END IF;

      IF coalesce(NEW.extra_data #>> '{managerControl,etiquettes}', '') NOT IN ('conforme', 'non_conforme')
        OR coalesce(NEW.extra_data #>> '{managerControl,cuisson}', '') NOT IN ('conforme', 'non_conforme')
        OR coalesce(NEW.extra_data #>> '{managerControl,forme}', '') NOT IN ('conforme', 'non_conforme')
        OR coalesce(NEW.extra_data #>> '{managerControl,nettoyage}', '') NOT IN ('conforme', 'non_conforme') THEN
        RAISE EXCEPTION 'Tous les contrôles manager doivent être marqués Conforme ou Non conforme';
      END IF;
    END IF;
  END IF;

  IF NEW.fiche_type = 'Décoration' THEN
    IF has_visa THEN
      IF NEW.extra_data IS NULL OR jsonb_typeof(NEW.extra_data) <> 'object' THEN
        RAISE EXCEPTION 'Les contrôles manager Décoration sont obligatoires';
      END IF;

      IF coalesce(NEW.extra_data #>> '{managerControl,etiquettesInterneExterne}', '') NOT IN ('conforme', 'non_conforme')
        OR coalesce(NEW.extra_data #>> '{managerControl,conformiteDecoration}', '') NOT IN ('conforme', 'non_conforme')
        OR coalesce(NEW.extra_data #>> '{managerControl,etatEmballage}', '') NOT IN ('conforme', 'non_conforme') THEN
        RAISE EXCEPTION 'Tous les contrôles manager Décoration doivent être marqués Conforme ou Non conforme';
      END IF;
    END IF;
  END IF;

  IF NEW.fiche_type = 'Panaché' THEN
    IF NEW.extra_data IS NULL OR jsonb_typeof(NEW.extra_data) <> 'object'
       OR jsonb_typeof(NEW.extra_data->'matieresPremieres') <> 'array' THEN
      RAISE EXCEPTION 'Les matières premières Panaché sont obligatoires';
    END IF;

    SELECT count(*) INTO panache_mat_count
    FROM jsonb_array_elements(NEW.extra_data->'matieresPremieres') AS m;

    IF panache_mat_count = 0 THEN
      RAISE EXCEPTION 'Les matières premières Panaché sont obligatoires';
    END IF;

    SELECT count(*) INTO panache_mat_incomplete
    FROM jsonb_array_elements(NEW.extra_data->'matieresPremieres') AS m
    WHERE length(trim(coalesce(m->>'lot', ''))) = 0;

    IF panache_mat_incomplete > 0 THEN
      RAISE EXCEPTION 'Le N° de lot est obligatoire pour chaque matière première';
    END IF;

    IF has_visa THEN
      IF coalesce(NEW.extra_data #>> '{managerControl,etiquettes}', '') NOT IN ('conforme', 'non_conforme')
        OR coalesce(NEW.extra_data #>> '{managerControl,poids}', '') NOT IN ('conforme', 'non_conforme')
        OR coalesce(NEW.extra_data #>> '{managerControl,remplissage}', '') NOT IN ('conforme', 'non_conforme') THEN
        RAISE EXCEPTION 'Tous les contrôles manager Panaché doivent être marqués Conforme ou Non conforme';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;