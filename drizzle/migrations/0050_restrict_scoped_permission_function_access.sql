REVOKE ALL ON FUNCTION public.has_pdv_permission(uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_pdv_permission(uuid, uuid, text) TO authenticated, service_role;