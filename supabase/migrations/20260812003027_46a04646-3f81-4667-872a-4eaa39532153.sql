CREATE TABLE public.weekly_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  fiche_type text NOT NULL,
  week_start text NOT NULL,
  transfer_date text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('recu','envoye')),
  article text,
  quantity numeric,
  lot_number text,
  location text,
  performed_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_transfers TO authenticated;
GRANT ALL ON public.weekly_transfers TO service_role;

ALTER TABLE public.weekly_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_transfers_select" ON public.weekly_transfers
FOR SELECT TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "weekly_transfers_insert" ON public.weekly_transfers
FOR INSERT TO authenticated
WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "weekly_transfers_update" ON public.weekly_transfers
FOR UPDATE TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id))
WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));

CREATE POLICY "weekly_transfers_delete" ON public.weekly_transfers
FOR DELETE TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id));

CREATE INDEX idx_weekly_transfers_pdv_fiche_week ON public.weekly_transfers (pdv_id, fiche_type, week_start);

CREATE TRIGGER update_weekly_transfers_updated_at
BEFORE UPDATE ON public.weekly_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();