INSERT INTO public.user_permissions (user_id, permission_key, allowed)
SELECT u.id, 'edit_remaining_stock', true
FROM auth.users u
WHERE lower(u.email) = 'gestionmaarif1@gmail.com'
ON CONFLICT (user_id, permission_key) DO UPDATE SET allowed = true;