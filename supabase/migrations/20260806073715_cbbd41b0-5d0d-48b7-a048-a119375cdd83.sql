-- Plusieurs PDV par utilisateur, sans doublon
CREATE UNIQUE INDEX IF NOT EXISTS user_pdvs_user_pdv_uniq ON public.user_pdvs (user_id, pdv_id);

-- Admin régional ?
CREATE OR REPLACE FUNCTION public.is_regional_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'regional_admin'::public.app_role)
$$;

-- Restriction d'accès aux PDV attribués pour les admins régionaux uniquement
CREATE OR REPLACE FUNCTION public.can_access_pdv(_user_id uuid, _pdv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.pdvs p WHERE p.id = _pdv_id)
     AND (
       NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = 'regional_admin'::public.app_role)
       OR EXISTS (SELECT 1 FROM public.user_pdvs up WHERE up.user_id = _user_id AND up.pdv_id = _pdv_id)
     )
$$;

-- Maximum 2 comptes Admin régional
CREATE OR REPLACE FUNCTION public.enforce_regional_admin_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  n integer;
BEGIN
  IF NEW.role = 'regional_admin'::public.app_role THEN
    SELECT count(DISTINCT user_id) INTO n
    FROM public.user_roles
    WHERE role = 'regional_admin'::public.app_role
      AND user_id <> NEW.user_id;
    IF n >= 2 THEN
      RAISE EXCEPTION 'Limite atteinte : 2 comptes Admin régional maximum';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regional_admin_limit ON public.user_roles;
CREATE TRIGGER trg_regional_admin_limit
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_regional_admin_limit();