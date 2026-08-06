CREATE OR REPLACE FUNCTION public.can_manage_pdv_permission(_user_id uuid, _pdv_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
      OR (
        public.is_regional_admin(_user_id)
        AND EXISTS (
          SELECT 1 FROM public.user_pdvs up
          WHERE up.user_id = _user_id AND up.pdv_id = _pdv_id
        )
        AND EXISTS (
          SELECT 1 FROM public.user_permissions upe
          WHERE upe.user_id = _user_id
            AND upe.permission_key = _permission_key
            AND upe.allowed = true
        )
      )
$$;

DROP POLICY IF EXISTS "pdv_permissions insert admin" ON public.pdv_permissions;
DROP POLICY IF EXISTS "pdv_permissions update admin" ON public.pdv_permissions;
DROP POLICY IF EXISTS "pdv_permissions delete admin" ON public.pdv_permissions;

CREATE POLICY "pdv_permissions insert managers" ON public.pdv_permissions
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_pdv_permission(auth.uid(), pdv_id, permission_key));

CREATE POLICY "pdv_permissions update managers" ON public.pdv_permissions
FOR UPDATE TO authenticated
USING (public.can_manage_pdv_permission(auth.uid(), pdv_id, permission_key))
WITH CHECK (public.can_manage_pdv_permission(auth.uid(), pdv_id, permission_key));

CREATE POLICY "pdv_permissions delete managers" ON public.pdv_permissions
FOR DELETE TO authenticated
USING (public.can_manage_pdv_permission(auth.uid(), pdv_id, permission_key));