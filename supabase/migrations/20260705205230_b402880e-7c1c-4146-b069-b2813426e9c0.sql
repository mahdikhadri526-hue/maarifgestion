
-- P1 Security: restrict internal SECURITY DEFINER helpers to server-side / policy usage only.
-- Policies invoke them as the definer, so REVOKE EXECUTE from client roles doesn't break RLS.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_inventory(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_participate_inventory(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.inventory_session_status(uuid) FROM anon, authenticated, public;

-- inv_mark_counter_done is a legitimate RPC called from the client; keep executable to authenticated only.
REVOKE EXECUTE ON FUNCTION public.inv_mark_counter_done(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.inv_mark_counter_done(uuid, text) TO authenticated;

-- P1 Security: remove hardcoded admin bootstrap by email.
-- New users are provisioned as viewer only. Admin role must be granted explicitly by an existing admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;
