DROP POLICY tech_issues_update ON public.tech_issues;
CREATE POLICY tech_issues_update ON public.tech_issues
FOR UPDATE TO authenticated
USING (
  public.can_access_tech(auth.uid(), pdv_id)
  AND (
    public.has_permission(auth.uid(), 'manage_tech')
    OR (
      processing_mode = 'manager'
      AND public.can_access_pdv(auth.uid(), pdv_id)
      AND public.has_permission(auth.uid(), 'view_tech')
    )
  )
)
WITH CHECK (
  public.can_access_tech(auth.uid(), pdv_id)
  AND (
    public.has_permission(auth.uid(), 'manage_tech')
    OR (
      processing_mode = 'manager'
      AND public.can_access_pdv(auth.uid(), pdv_id)
      AND public.has_permission(auth.uid(), 'view_tech')
    )
  )
);