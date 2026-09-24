DROP POLICY IF EXISTS "Regional admins view all profiles" ON public.profiles;
CREATE POLICY "Regional admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING ((SELECT public.is_regional_admin(auth.uid())));
DROP POLICY IF EXISTS "Regional admins view all roles" ON public.user_roles;
CREATE POLICY "Regional admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING ((SELECT public.is_regional_admin(auth.uid())));
DROP POLICY IF EXISTS "Regional admins view all user pdvs" ON public.user_pdvs;
CREATE POLICY "Regional admins view all user pdvs" ON public.user_pdvs FOR SELECT TO authenticated USING ((SELECT public.is_regional_admin(auth.uid())));