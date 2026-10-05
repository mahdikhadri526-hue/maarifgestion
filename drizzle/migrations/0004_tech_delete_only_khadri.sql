DROP POLICY IF EXISTS tech_issues_delete ON public.tech_issues;
CREATE POLICY tech_issues_delete ON public.tech_issues FOR DELETE TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email','')) = 'khadri1982@gmail.com');