GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_issues TO authenticated;
GRANT ALL ON public.tech_issues TO service_role;
GRANT SELECT ON public.tech_issue_events TO authenticated;
GRANT ALL ON public.tech_issue_events TO service_role;