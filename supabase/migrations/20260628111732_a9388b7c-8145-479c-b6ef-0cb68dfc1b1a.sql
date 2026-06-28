
-- Inventory module: double-blind counting sessions
-- Adds 4 new tables, none of the existing tables are modified.

CREATE TABLE IF NOT EXISTS public.inventory_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'counting' CHECK (status IN ('counting','reconciling','closed')),
  counter_a_user_id UUID,
  counter_b_user_id UUID,
  counter_a_done BOOLEAN NOT NULL DEFAULT false,
  counter_b_done BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_sessions TO authenticated;
GRANT ALL ON public.inventory_sessions TO service_role;
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.inventory_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  lot_id UUID,
  lot_number TEXT,
  theoretical_qty NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_lines_session_idx ON public.inventory_lines(session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_lines TO authenticated;
GRANT ALL ON public.inventory_lines TO service_role;
ALTER TABLE public.inventory_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES public.inventory_lines(id) ON DELETE CASCADE,
  counter_slot TEXT NOT NULL CHECK (counter_slot IN ('A','B')),
  counted_by_user_id UUID NOT NULL,
  stock_qty NUMERIC,
  mise_en_place_qty NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, line_id, counter_slot)
);
CREATE INDEX IF NOT EXISTS inventory_counts_session_idx ON public.inventory_counts(session_id);
CREATE INDEX IF NOT EXISTS inventory_counts_user_idx ON public.inventory_counts(counted_by_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_counts TO authenticated;
GRANT ALL ON public.inventory_counts TO service_role;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.inventory_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES public.inventory_lines(id) ON DELETE CASCADE,
  final_stock_qty NUMERIC,
  final_mise_en_place_qty NUMERIC,
  variance_vs_theoretical NUMERIC,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, line_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_resolutions TO authenticated;
GRANT ALL ON public.inventory_resolutions TO service_role;
ALTER TABLE public.inventory_resolutions ENABLE ROW LEVEL SECURITY;

-- Helper: is user a manager/admin for inventory? (uses has_permission)
CREATE OR REPLACE FUNCTION public.can_manage_inventory(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
      OR public.has_permission(_user_id, 'manage_inventory')
$$;

CREATE OR REPLACE FUNCTION public.can_participate_inventory(_user_id UUID, _session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_sessions s
    WHERE s.id = _session_id
      AND (s.counter_a_user_id = _user_id OR s.counter_b_user_id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.inventory_session_status(_session_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.inventory_sessions WHERE id = _session_id
$$;

-- Policies: sessions
CREATE POLICY "inv sessions select"
  ON public.inventory_sessions FOR SELECT
  TO authenticated
  USING (
    public.can_manage_inventory(auth.uid())
    OR counter_a_user_id = auth.uid()
    OR counter_b_user_id = auth.uid()
  );

CREATE POLICY "inv sessions insert manager"
  ON public.inventory_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_inventory(auth.uid()));

CREATE POLICY "inv sessions update manager or counter done"
  ON public.inventory_sessions FOR UPDATE
  TO authenticated
  USING (
    public.can_manage_inventory(auth.uid())
    OR counter_a_user_id = auth.uid()
    OR counter_b_user_id = auth.uid()
  )
  WITH CHECK (
    public.can_manage_inventory(auth.uid())
    OR counter_a_user_id = auth.uid()
    OR counter_b_user_id = auth.uid()
  );

CREATE POLICY "inv sessions delete manager"
  ON public.inventory_sessions FOR DELETE
  TO authenticated
  USING (public.can_manage_inventory(auth.uid()));

-- Policies: lines
-- Managers see everything (including theoretical_qty). Counters see only the
-- line metadata (theoretical_qty is masked client-side; UI never shows it).
CREATE POLICY "inv lines select"
  ON public.inventory_lines FOR SELECT
  TO authenticated
  USING (
    public.can_manage_inventory(auth.uid())
    OR public.can_participate_inventory(auth.uid(), session_id)
  );

CREATE POLICY "inv lines insert manager"
  ON public.inventory_lines FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_inventory(auth.uid()));

CREATE POLICY "inv lines update manager"
  ON public.inventory_lines FOR UPDATE
  TO authenticated
  USING (public.can_manage_inventory(auth.uid()))
  WITH CHECK (public.can_manage_inventory(auth.uid()));

CREATE POLICY "inv lines delete manager"
  ON public.inventory_lines FOR DELETE
  TO authenticated
  USING (public.can_manage_inventory(auth.uid()));

-- Policies: counts — strict double-blind
-- A counter can only see / write their own slot rows while the session is in 'counting'.
-- Managers can read everything once session is reconciling/closed.
CREATE POLICY "inv counts select own or manager after counting"
  ON public.inventory_counts FOR SELECT
  TO authenticated
  USING (
    counted_by_user_id = auth.uid()
    OR (
      public.can_manage_inventory(auth.uid())
      AND public.inventory_session_status(session_id) IN ('reconciling','closed')
    )
  );

CREATE POLICY "inv counts insert own slot"
  ON public.inventory_counts FOR INSERT
  TO authenticated
  WITH CHECK (
    counted_by_user_id = auth.uid()
    AND public.inventory_session_status(session_id) = 'counting'
    AND public.can_participate_inventory(auth.uid(), session_id)
  );

CREATE POLICY "inv counts update own slot"
  ON public.inventory_counts FOR UPDATE
  TO authenticated
  USING (
    counted_by_user_id = auth.uid()
    AND public.inventory_session_status(session_id) = 'counting'
  )
  WITH CHECK (
    counted_by_user_id = auth.uid()
    AND public.inventory_session_status(session_id) = 'counting'
  );

CREATE POLICY "inv counts delete manager"
  ON public.inventory_counts FOR DELETE
  TO authenticated
  USING (public.can_manage_inventory(auth.uid()));

-- Policies: resolutions (manager only)
CREATE POLICY "inv resolutions select"
  ON public.inventory_resolutions FOR SELECT
  TO authenticated
  USING (public.can_manage_inventory(auth.uid()));

CREATE POLICY "inv resolutions insert"
  ON public.inventory_resolutions FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_inventory(auth.uid()));

CREATE POLICY "inv resolutions update"
  ON public.inventory_resolutions FOR UPDATE
  TO authenticated
  USING (public.can_manage_inventory(auth.uid()))
  WITH CHECK (public.can_manage_inventory(auth.uid()));

CREATE POLICY "inv resolutions delete"
  ON public.inventory_resolutions FOR DELETE
  TO authenticated
  USING (public.can_manage_inventory(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_inventory_sessions_updated_at
  BEFORE UPDATE ON public.inventory_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_inventory_counts_updated_at
  BEFORE UPDATE ON public.inventory_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_counts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_lines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_resolutions;
