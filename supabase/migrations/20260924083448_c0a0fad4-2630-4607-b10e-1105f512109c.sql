REVOKE EXECUTE ON FUNCTION public.shares_pdv(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_pdv(uuid, uuid) TO authenticated;