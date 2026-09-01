CREATE TABLE public.tech_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  equipment text NOT NULL,
  location text,
  problem text NOT NULL,
  photo_url text,
  reported_by text NOT NULL,
  reported_by_user uuid,
  priority text NOT NULL DEFAULT 'normale' CHECK (priority IN ('critique','urgente','normale')),
  reported_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'a_traiter' CHECK (status IN ('a_traiter','en_cours','repare','cloture')),
  assigned_to text,
  deadline date,
  tech_notes text,
  taken_at timestamptz,
  repaired_at timestamptz,
  closed_at timestamptz,
  source_task_id uuid REFERENCES public.pep_tasks(id) ON DELETE SET NULL,
  source_occurrence_id uuid REFERENCES public.pep_occurrences(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tech_issues_pdv_status ON public.tech_issues (pdv_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_issues TO authenticated;
GRANT ALL ON public.tech_issues TO service_role;
ALTER TABLE public.tech_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tech_issues_select" ON public.tech_issues FOR SELECT TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND (
    public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep') OR public.has_permission(auth.uid(), 'manage_tech')));
CREATE POLICY "tech_issues_insert" ON public.tech_issues FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND (
    public.has_permission(auth.uid(), 'view_pep') OR public.has_permission(auth.uid(), 'manage_pep') OR public.has_permission(auth.uid(), 'manage_tech')));
CREATE POLICY "tech_issues_update" ON public.tech_issues FOR UPDATE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_tech'))
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_tech'));
CREATE POLICY "tech_issues_delete" ON public.tech_issues FOR DELETE TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_permission(auth.uid(), 'manage_tech'));

CREATE TRIGGER trg_tech_issues_updated_at BEFORE UPDATE ON public.tech_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();