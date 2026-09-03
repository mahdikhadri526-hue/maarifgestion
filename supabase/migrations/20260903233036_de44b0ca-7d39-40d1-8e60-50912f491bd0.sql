CREATE OR REPLACE FUNCTION public.can_access_tech(_user_id uuid, _pdv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_pdv(_user_id, _pdv_id)
      OR public.has_permission(_user_id, 'manage_tech')
$$;

DROP POLICY IF EXISTS tech_issues_select ON public.tech_issues;
CREATE POLICY tech_issues_select ON public.tech_issues FOR SELECT TO authenticated
USING (
  public.can_access_tech(auth.uid(), pdv_id)
  AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')
       OR public.has_permission(auth.uid(), 'manage_tech') OR public.has_permission(auth.uid(), 'view_tech'))
);

DROP POLICY IF EXISTS tech_issues_update ON public.tech_issues;
CREATE POLICY tech_issues_update ON public.tech_issues FOR UPDATE TO authenticated
USING (public.can_access_tech(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_tech'))
WITH CHECK (public.can_access_tech(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_tech'));

DROP POLICY IF EXISTS tech_issues_delete ON public.tech_issues;
CREATE POLICY tech_issues_delete ON public.tech_issues FOR DELETE TO authenticated
USING (public.can_access_tech(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_tech'));

DROP POLICY IF EXISTS tech_issue_events_select ON public.tech_issue_events;
CREATE POLICY tech_issue_events_select ON public.tech_issue_events FOR SELECT TO authenticated
USING (
  public.can_access_tech(auth.uid(), pdv_id)
  AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep')
       OR public.has_permission(auth.uid(), 'manage_tech') OR public.has_permission(auth.uid(), 'view_tech'))
);