CREATE OR REPLACE FUNCTION public.can_access_pdv(_user_id uuid, _pdv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL
     AND _pdv_id IS NOT NULL
     AND (
       public.is_admin(_user_id)
       OR EXISTS (
         SELECT 1 FROM public.user_pdvs up
         WHERE up.user_id = _user_id AND up.pdv_id = _pdv_id
       )
     )
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN _user_id IS NULL THEN false
      WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN true
      WHEN EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission_key = _permission_key AND allowed = true) THEN true
      WHEN EXISTS (
        SELECT 1
        FROM public.pdv_permissions pp
        JOIN public.pdvs p ON p.id = pp.pdv_id AND p.active = true
        JOIN public.user_pdvs up ON up.pdv_id = p.id AND up.user_id = _user_id
        WHERE pp.permission_key = _permission_key AND pp.allowed = true
      ) THEN true
      ELSE false
    END
$function$;

DROP POLICY IF EXISTS "auth can write capacity" ON public.glace_storage_capacity;