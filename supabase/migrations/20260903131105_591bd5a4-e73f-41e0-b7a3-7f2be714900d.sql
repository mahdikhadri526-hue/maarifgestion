CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN public.is_admin(_user_id) THEN true
    WHEN public.is_regional_admin(_user_id) THEN EXISTS (
      SELECT 1
      FROM public.user_permissions upe
      WHERE upe.user_id = _user_id
        AND upe.permission_key = _permission_key
        AND upe.allowed = true
    )
    ELSE (
      EXISTS (
        SELECT 1 FROM public.user_permissions upe
        WHERE upe.user_id = _user_id AND upe.permission_key = _permission_key AND upe.allowed = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_pdvs up
        JOIN public.pdvs p ON p.id = up.pdv_id AND p.active = true
        JOIN public.pdv_permissions pp ON pp.pdv_id = up.pdv_id
        WHERE up.user_id = _user_id
          AND pp.permission_key = _permission_key
          AND pp.allowed = true
      )
    )
  END
$function$;