REVOKE EXECUTE ON FUNCTION public.is_agent_scheduled_for_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_agent_scheduled_for_user(uuid, uuid) TO authenticated, service_role;