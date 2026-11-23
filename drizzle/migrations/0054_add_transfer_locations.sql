CREATE TABLE public.transfer_locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100 AND name = btrim(name)),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transfer_locations TO authenticated;
GRANT ALL ON public.transfer_locations TO service_role;
ALTER TABLE public.transfer_locations ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX transfer_locations_name_unique ON public.transfer_locations (lower(name));
CREATE POLICY "Authenticated users read transfer locations" ON public.transfer_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins add transfer locations" ON public.transfer_locations FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));