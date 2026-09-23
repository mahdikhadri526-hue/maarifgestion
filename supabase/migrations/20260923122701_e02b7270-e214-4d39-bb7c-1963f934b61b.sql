CREATE OR REPLACE FUNCTION public.enforce_regional_admin_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'regional_admin' THEN
    IF (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role = 'regional_admin' AND user_id <> NEW.user_id) >= 10 THEN
      RAISE EXCEPTION 'Limite atteinte : 10 comptes Admin régional maximum';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;