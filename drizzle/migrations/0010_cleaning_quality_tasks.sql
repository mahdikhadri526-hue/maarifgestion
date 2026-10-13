ALTER TABLE public.cleaning_logs ADD COLUMN IF NOT EXISTS quality_tasks jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.is_quality_account(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND lower(email) = 'gestion-qualite@oliveri.com')
$$;

CREATE OR REPLACE FUNCTION public.cleaning_quality_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.quality_rpc', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.quality_tasks := '{}'::jsonb;
  ELSIF NEW.quality_tasks IS DISTINCT FROM OLD.quality_tasks THEN
    NEW.quality_tasks := OLD.quality_tasks;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cleaning_quality_guard ON public.cleaning_logs;
CREATE TRIGGER cleaning_quality_guard BEFORE INSERT OR UPDATE ON public.cleaning_logs
FOR EACH ROW EXECUTE FUNCTION public.cleaning_quality_guard();

CREATE OR REPLACE FUNCTION public.set_cleaning_quality(_log_id uuid, _task text, _value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pdv uuid;
BEGIN
  IF NOT public.is_quality_account(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé au service qualité';
  END IF;
  IF _value IS NOT NULL AND _value NOT IN ('C','NC') THEN
    RAISE EXCEPTION 'Valeur invalide';
  END IF;
  SELECT pdv_id INTO _pdv FROM public.cleaning_logs WHERE id = _log_id;
  IF _pdv IS NULL OR NOT (_pdv IN (SELECT public.user_pdv_ids(auth.uid())) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'PDV non autorisé';
  END IF;
  PERFORM set_config('app.quality_rpc', 'on', true);
  UPDATE public.cleaning_logs
     SET quality_tasks = CASE WHEN _value IS NULL THEN quality_tasks - _task
                              ELSE quality_tasks || jsonb_build_object(_task, _value) END
   WHERE id = _log_id;
  PERFORM set_config('app.quality_rpc', 'off', true);
END $$;

REVOKE ALL ON FUNCTION public.set_cleaning_quality(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_cleaning_quality(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_quality_account(uuid) TO authenticated;