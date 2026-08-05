ALTER TABLE public.pdvs ADD COLUMN IF NOT EXISTS access_code text NOT NULL DEFAULT '1975';

CREATE OR REPLACE FUNCTION public.can_access_pdv(_user_id uuid, _pdv_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.pdvs p WHERE p.id = _pdv_id)
$function$;

CREATE OR REPLACE FUNCTION public.verify_pdv_code(_pdv_id uuid, _code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pdvs p
    WHERE p.id = _pdv_id AND p.active = true AND p.access_code = _code
  )
$function$;

GRANT EXECUTE ON FUNCTION public.verify_pdv_code(uuid, text) TO authenticated;