REVOKE ALL ON TABLE public.stock_total_openings FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.stock_total_openings FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.stock_total_openings TO authenticated;