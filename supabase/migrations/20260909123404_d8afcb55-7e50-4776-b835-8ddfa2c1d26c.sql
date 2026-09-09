create or replace function public.export_auth_sql()
returns text
language sql
security definer
set search_path = public, auth
as $$
  select coalesce((select string_agg(format('INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,last_sign_in_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at,confirmed_at,email_change_token_current,email_change_confirm_status,is_sso_user,is_anonymous) VALUES (%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L) ON CONFLICT (id) DO NOTHING;',
      u.instance_id,u.id,u.aud,u.role,u.email,u.encrypted_password,u.email_confirmed_at,u.confirmation_token,u.recovery_token,u.email_change_token_new,u.email_change,u.last_sign_in_at,u.raw_app_meta_data,u.raw_user_meta_data,u.is_super_admin,u.created_at,u.updated_at,u.confirmed_at,u.email_change_token_current,u.email_change_confirm_status,u.is_sso_user,u.is_anonymous), E'\n') from auth.users u), '')
  || E'\n\n' ||
  coalesce((select string_agg(format('INSERT INTO auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id) VALUES (%L,%L,%L,%L,%L,%L,%L,%L) ON CONFLICT (id) DO NOTHING;',
      i.provider_id,i.user_id,i.identity_data,i.provider,i.last_sign_in_at,i.created_at,i.updated_at,i.id), E'\n') from auth.identities i), '');
$$;
revoke all on function public.export_auth_sql() from public, anon, authenticated;
grant execute on function public.export_auth_sql() to service_role;