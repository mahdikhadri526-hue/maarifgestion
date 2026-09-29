DROP POLICY tech_issues_insert ON public.tech_issues;
CREATE POLICY tech_issues_insert ON public.tech_issues FOR INSERT TO authenticated
WITH CHECK (
  pdv_id IS NOT NULL AND (
    (SELECT has_permission(auth.uid(), 'manage_tech'))
    OR (
      ((SELECT is_admin(auth.uid())) OR pdv_id IN (SELECT user_pdv_ids(auth.uid())))
      AND ((SELECT has_permission(auth.uid(), 'view_pep')) OR (SELECT has_permission(auth.uid(), 'manage_pep')))
    )
  )
);