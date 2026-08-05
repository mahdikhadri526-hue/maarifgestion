-- 1. PDV table
CREATE TABLE public.pdvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdvs TO authenticated;
GRANT ALL ON public.pdvs TO service_role;
ALTER TABLE public.pdvs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pdvs_updated_at BEFORE UPDATE ON public.pdvs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pdvs (id, code, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'PDV1', 'PDV principal');

-- 2. user <-> pdv assignments
CREATE TABLE public.user_pdvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pdv_id uuid NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pdv_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_pdvs TO authenticated;
GRANT ALL ON public.user_pdvs TO service_role;
ALTER TABLE public.user_pdvs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_pdvs_user ON public.user_pdvs(user_id);

INSERT INTO public.user_pdvs (user_id, pdv_id)
SELECT id, '00000000-0000-0000-0000-000000000001' FROM auth.users
ON CONFLICT DO NOTHING;

-- 3. access helper
CREATE OR REPLACE FUNCTION public.can_access_pdv(_user_id uuid, _pdv_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_pdvs up WHERE up.user_id = _user_id AND up.pdv_id = _pdv_id)
  )
$$;

-- 4. policies on pdvs / user_pdvs
CREATE POLICY "pdvs select own" ON public.pdvs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_pdvs up WHERE up.user_id = auth.uid() AND up.pdv_id = pdvs.id));
CREATE POLICY "pdvs insert admin" ON public.pdvs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "pdvs update admin" ON public.pdvs FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "pdvs delete admin" ON public.pdvs FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "user_pdvs select" ON public.user_pdvs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_pdvs insert admin" ON public.user_pdvs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "user_pdvs update admin" ON public.user_pdvs FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "user_pdvs delete admin" ON public.user_pdvs FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 5. add pdv_id to scoped tables, backfill, index, restrictive isolation policy
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'autocontrols','cleaning_logs','fridge_temperatures','initial_stocks',
    'inventory_counts','inventory_lines','inventory_resolutions','inventory_sessions',
    'lot_entries','order_placed_products','production_entries','requisitions',
    'saved_orders','stock_movements','weekly_tracking'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN pdv_id uuid NOT NULL DEFAULT ''00000000-0000-0000-0000-000000000001''::uuid REFERENCES public.pdvs(id)', t);
    EXECUTE format('CREATE INDEX %I ON public.%I(pdv_id)', 'idx_' || t || '_pdv', t);
    EXECUTE format('CREATE POLICY "pdv isolation" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id)) WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id))', t);
  END LOOP;
END $$;

-- 6. adjust unique constraints to be per-PDV
ALTER TABLE public.initial_stocks DROP CONSTRAINT initial_stocks_product_id_key;
ALTER TABLE public.initial_stocks ADD CONSTRAINT initial_stocks_pdv_product_key UNIQUE (pdv_id, product_id);

ALTER TABLE public.fridge_temperatures DROP CONSTRAINT fridge_unique;
ALTER TABLE public.fridge_temperatures ADD CONSTRAINT fridge_unique UNIQUE (pdv_id, control_date, slot, equipment_code);

DROP INDEX public.weekly_tracking_unique_cell;
CREATE UNIQUE INDEX weekly_tracking_unique_cell ON public.weekly_tracking (pdv_id, fiche_type, week_start, day_of_week, row_index, COALESCE(article, ''::text));
DROP INDEX public.weekly_tracking_conflict_key;
CREATE UNIQUE INDEX weekly_tracking_conflict_key ON public.weekly_tracking (pdv_id, fiche_type, week_start, day_of_week, row_index, article);

ALTER TABLE public.order_placed_products DROP CONSTRAINT order_placed_products_pkey;
ALTER TABLE public.order_placed_products ADD CONSTRAINT order_placed_products_pkey PRIMARY KEY (pdv_id, product_id);