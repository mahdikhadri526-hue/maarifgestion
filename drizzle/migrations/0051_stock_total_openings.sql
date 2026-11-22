CREATE TABLE public.stock_total_openings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 pdv_id uuid NOT NULL REFERENCES public.pdvs(id),
 product_id text NOT NULL CHECK (btrim(product_id) <> '' AND product_id NOT LIKE '\_\_%'),
 category text NOT NULL CHECK (category IN ('alimentaire', 'emballage')),
 opening_date date NOT NULL,
 quantity numeric NOT NULL CHECK (quantity >= 0 AND quantity NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
 performed_by text NOT NULL CHECK (btrim(performed_by) <> ''),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (pdv_id, product_id)
);
GRANT SELECT, INSERT ON public.stock_total_openings TO authenticated;
GRANT ALL ON public.stock_total_openings TO service_role;
ALTER TABLE public.stock_total_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_total_openings_read ON public.stock_total_openings FOR SELECT TO authenticated USING (public.can_access_pdv(auth.uid(), pdv_id));
CREATE POLICY stock_total_openings_create ON public.stock_total_openings FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'));
COMMENT ON TABLE public.stock_total_openings IS 'One-time dated opening for total stock only; operational stock and movement history are never rewritten.';