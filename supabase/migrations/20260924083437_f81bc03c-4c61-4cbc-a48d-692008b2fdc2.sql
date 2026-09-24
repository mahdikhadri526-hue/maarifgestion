CREATE OR REPLACE FUNCTION public.shares_pdv(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_pdvs a JOIN user_pdvs b ON a.pdv_id = b.pdv_id
                 WHERE a.user_id = _viewer AND b.user_id = _target)
$$;
DROP POLICY IF EXISTS "Regional admins view all profiles" ON public.profiles;
CREATE POLICY "Regional admins view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.is_regional_admin(auth.uid())) AND public.shares_pdv(auth.uid(), user_id));
DROP POLICY IF EXISTS "Regional admins view all roles" ON public.user_roles;
CREATE POLICY "Regional admins view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING ((SELECT public.is_regional_admin(auth.uid())) AND public.shares_pdv(auth.uid(), user_id));
DROP POLICY IF EXISTS "Regional admins view all user pdvs" ON public.user_pdvs;
CREATE POLICY "Regional admins view all user pdvs" ON public.user_pdvs FOR SELECT TO authenticated
  USING ((SELECT public.is_regional_admin(auth.uid())) AND public.shares_pdv(auth.uid(), user_id));