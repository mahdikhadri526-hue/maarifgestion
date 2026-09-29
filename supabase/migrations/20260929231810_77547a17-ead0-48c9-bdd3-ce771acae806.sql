ALTER TABLE public.tech_issues
  ADD COLUMN IF NOT EXISTS parts_changed text,
  ADD COLUMN IF NOT EXISTS parts_price numeric,
  ADD COLUMN IF NOT EXISTS service_price numeric;