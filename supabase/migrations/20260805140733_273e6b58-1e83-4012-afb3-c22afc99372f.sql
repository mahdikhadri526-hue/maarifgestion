INSERT INTO public.user_permissions (user_id, permission_key, allowed)
SELECT p.user_id, k.key, true
FROM public.profiles p
CROSS JOIN (VALUES ('view_stock'),('view_reports'),('view_recipes'),('view_cleaning'),('edit_cleaning'),('view_inventory')) AS k(key)
WHERE lower(p.email) = 'gestionmaarif1@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = p.user_id AND up.permission_key = k.key
  );