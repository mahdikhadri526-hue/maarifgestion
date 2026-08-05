-- Tous les utilisateurs connectés peuvent lister les PDV (l'accès réel est protégé par le code d'accès)
DROP POLICY IF EXISTS "pdvs select own" ON public.pdvs;
CREATE POLICY "pdvs select authenticated" ON public.pdvs
  FOR SELECT TO authenticated USING (true);

-- Masquer la colonne access_code : lecture par colonnes, sans access_code
REVOKE SELECT ON public.pdvs FROM authenticated;
GRANT SELECT (id, code, name, active, default_role, created_at, updated_at) ON public.pdvs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pdvs TO authenticated;
GRANT ALL ON public.pdvs TO service_role;

-- Le compte administrateur unique
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  IF lower(NEW.email) = 'khadri1982@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;