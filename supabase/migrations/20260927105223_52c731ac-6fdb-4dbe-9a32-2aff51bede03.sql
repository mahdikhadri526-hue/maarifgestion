CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings (key, value) VALUES ('kiosk_pin', '1975');