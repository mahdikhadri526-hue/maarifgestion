INSERT INTO public.user_permissions (user_id, permission_key, allowed)
SELECT p.user_id, 'view_movements', true
FROM public.profiles p
WHERE p.email = 'gestionmaarif1@gmail.com'
ON CONFLICT (user_id, permission_key) DO UPDATE SET allowed = true;