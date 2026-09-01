REVOKE EXECUTE ON FUNCTION public.tech_issues_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tech_manager_validate(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_manager_validate(uuid, text, text, boolean) TO authenticated;