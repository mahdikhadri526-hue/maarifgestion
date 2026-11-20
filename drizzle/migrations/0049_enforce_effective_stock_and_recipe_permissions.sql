CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT CASE
 WHEN _user_id IS NULL THEN false
 WHEN public.is_admin(_user_id) AND (
   EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user_id AND lower(u.email) = 'gestionmaarif1@gmail.com')
   OR NOT EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id = _user_id)
 ) THEN true
 WHEN public.is_admin(_user_id) OR public.is_regional_admin(_user_id)
   OR EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id = _user_id)
 THEN EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id = _user_id AND p.permission_key = _permission_key AND p.allowed)
 ELSE EXISTS (
   SELECT 1 FROM public.user_pdvs up JOIN public.pdvs d ON d.id = up.pdv_id AND d.active
   JOIN public.pdv_permissions p ON p.pdv_id = up.pdv_id
   WHERE up.user_id = _user_id AND p.permission_key = _permission_key AND p.allowed
 ) END;
$$;

CREATE OR REPLACE FUNCTION public.has_pdv_permission(_user_id uuid, _pdv_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT public.can_access_pdv(_user_id, _pdv_id) AND CASE
 WHEN public.is_admin(_user_id) OR public.is_regional_admin(_user_id)
 THEN public.has_permission(_user_id, _permission_key)
 WHEN EXISTS (SELECT 1 FROM public.pdv_permissions p WHERE p.pdv_id = _pdv_id AND p.permission_key = _permission_key AND NOT p.allowed) THEN false
 WHEN EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id = _user_id)
 THEN EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id = _user_id AND p.permission_key = _permission_key AND p.allowed)
 ELSE EXISTS (SELECT 1 FROM public.pdv_permissions p WHERE p.pdv_id = _pdv_id AND p.permission_key = _permission_key AND p.allowed)
 END;
$$;
REVOKE ALL ON FUNCTION public.has_pdv_permission(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_pdv_permission(uuid, uuid, text) TO authenticated, service_role;

CREATE POLICY remaining_stock_insert_guard ON public.stock_movements AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (source IS DISTINCT FROM 'regularisation' OR public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'));
CREATE POLICY remaining_stock_update_guard ON public.stock_movements AS RESTRICTIVE FOR UPDATE TO authenticated
USING (source IS DISTINCT FROM 'regularisation' OR public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'))
WITH CHECK (source IS DISTINCT FROM 'regularisation' OR public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'));
CREATE POLICY remaining_stock_delete_guard ON public.stock_movements AS RESTRICTIVE FOR DELETE TO authenticated
USING (source IS DISTINCT FROM 'regularisation' OR public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'));

CREATE POLICY mep_permission_insert_guard ON public.mise_en_place_stocks AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'));
CREATE POLICY mep_permission_update_guard ON public.mise_en_place_stocks AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'))
WITH CHECK (public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'));
CREATE POLICY mep_permission_delete_guard ON public.mise_en_place_stocks AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'));

CREATE POLICY initial_stock_insert_permission_guard ON public.initial_stocks AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.has_pdv_permission(auth.uid(), pdv_id, 'edit_stock'));
CREATE POLICY initial_stock_update_permission_guard ON public.initial_stocks AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.has_pdv_permission(auth.uid(), pdv_id, 'edit_stock'))
WITH CHECK (public.has_pdv_permission(auth.uid(), pdv_id, 'edit_stock'));
CREATE POLICY initial_stock_delete_permission_guard ON public.initial_stocks AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.has_pdv_permission(auth.uid(), pdv_id, 'delete_stock'));

CREATE OR REPLACE FUNCTION public.can_manage_shared_catalog()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin')
 AND lower(coalesce(auth.jwt()->>'email', '')) = 'khadri1982@gmail.com'
 AND public.has_permission(auth.uid(), 'edit_recipes');
$$;