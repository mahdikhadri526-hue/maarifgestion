ALTER TABLE public.tech_issues ADD COLUMN processing_mode text NOT NULL DEFAULT 'technique';
ALTER TABLE public.tech_issues ADD CONSTRAINT tech_issues_processing_mode_check CHECK (processing_mode IN ('technique', 'manager'));
ALTER TABLE public.tech_issues ADD COLUMN handler_name text;
COMMENT ON COLUMN public.tech_issues.processing_mode IS 'Traitement du signalement : technique (responsable technique) ou manager (le manager du PDV suit les memes etapes)';
COMMENT ON COLUMN public.tech_issues.handler_name IS 'Nom du manager traitant quand processing_mode = manager';

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
      AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep'))
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
      AND (public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep'))
    )
  )
);