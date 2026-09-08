CREATE TABLE public.claims_returns (
  id uuid primary key default gen_random_uuid(),
  pdv_id uuid not null references public.pdvs(id) on delete cascade,
  kind text not null check (kind in ('reclamation','retour')),
  entry_date date not null,
  entry_time text,
  manager text,
  origine text,
  claim_type text,
  produit text,
  description text,
  action_corrective text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE INDEX claims_returns_pdv_date_idx ON public.claims_returns (pdv_id, entry_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims_returns TO authenticated;
GRANT ALL ON public.claims_returns TO service_role;
ALTER TABLE public.claims_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims_returns access" ON public.claims_returns FOR ALL TO authenticated
  USING (public.can_access_pdv(auth.uid(), pdv_id))
  WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id));
CREATE TRIGGER update_claims_returns_updated_at BEFORE UPDATE ON public.claims_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();