CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.verify_kiosk_pin(_pin text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND _pin IS NOT NULL AND _pin = COALESCE(
    (SELECT value FROM public.app_settings WHERE key = 'kiosk_pin'), '1975')
$$;
REVOKE EXECUTE ON FUNCTION public.verify_kiosk_pin(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.verify_kiosk_pin(text) TO authenticated;

-- app_settings
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.app_settings;
CREATE POLICY "Admins can read settings" ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- glace_storage_capacity
DROP POLICY IF EXISTS "auth can read capacity" ON public.glace_storage_capacity;
DROP POLICY IF EXISTS "capacity_select_authenticated" ON public.glace_storage_capacity;
CREATE POLICY "capacity_select_staff" ON public.glace_storage_capacity FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

-- hr_holidays
DROP POLICY IF EXISTS "hr_holidays_select" ON public.hr_holidays;
CREATE POLICY "hr_holidays_select" ON public.hr_holidays FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

-- product_catalog
DROP POLICY IF EXISTS "product_catalog_select" ON public.product_catalog;
CREATE POLICY "product_catalog_select" ON public.product_catalog FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

-- pdv_shift_times
DROP POLICY IF EXISTS "shift_times_select" ON public.pdv_shift_times;
CREATE POLICY "shift_times_select" ON public.pdv_shift_times FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.is_regional_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_hr'));

-- pdv_permissions
DROP POLICY IF EXISTS "pdv_permissions select authenticated" ON public.pdv_permissions;
CREATE POLICY "pdv_permissions select scoped" ON public.pdv_permissions FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) OR public.is_regional_admin(auth.uid()));

-- pdvs: staff only, and hide access codes
DROP POLICY IF EXISTS "pdvs select authenticated" ON public.pdvs;
CREATE POLICY "pdvs select staff" ON public.pdvs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));
REVOKE SELECT ON public.pdvs FROM authenticated, anon;
GRANT SELECT (id, code, name, active, created_at, updated_at, default_role) ON public.pdvs TO authenticated;

-- order_placed_products
DROP POLICY IF EXISTS "auth read order_placed" ON public.order_placed_products;
DROP POLICY IF EXISTS "auth insert order_placed" ON public.order_placed_products;
DROP POLICY IF EXISTS "auth update order_placed" ON public.order_placed_products;
DROP POLICY IF EXISTS "auth delete order_placed" ON public.order_placed_products;
CREATE POLICY "order_placed select" ON public.order_placed_products FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "order_placed insert" ON public.order_placed_products FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "order_placed update" ON public.order_placed_products FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id)) WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY "order_placed delete" ON public.order_placed_products FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id));

-- voice_guides
DROP POLICY IF EXISTS "Authenticated users can view voice guides" ON public.voice_guides;
CREATE POLICY "Permitted users can view voice guides" ON public.voice_guides FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'listen_voice_guides'));

-- welcome_photos
DROP POLICY IF EXISTS "Signed in users can see welcome photos" ON public.welcome_photos;
CREATE POLICY "Permitted users can see welcome photos" ON public.welcome_photos FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'view_welcome_screen') OR public.has_permission(auth.uid(), 'manage_welcome_screen'));

-- storage
DROP POLICY IF EXISTS "Signed in users can read welcome images" ON storage.objects;
CREATE POLICY "Permitted users can read welcome images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'welcome-photos' AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'view_welcome_screen') OR public.has_permission(auth.uid(), 'manage_welcome_screen')));
DROP POLICY IF EXISTS "Authenticated users can listen to voice guides" ON storage.objects;
CREATE POLICY "Permitted users can listen to voice guides" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-guides' AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'listen_voice_guides')));