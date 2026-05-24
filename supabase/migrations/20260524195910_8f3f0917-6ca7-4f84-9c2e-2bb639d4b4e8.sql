
-- Table de prise de température des frigos (HACCP)
CREATE TABLE public.fridge_temperatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_date text NOT NULL,
  slot text NOT NULL,
  zone text NOT NULL,
  equipment_code text NOT NULL,
  equipment_name text NOT NULL,
  equipment_type text NOT NULL,
  temperature_haut numeric,
  temperature_bas numeric,
  commentaire text,
  performed_by text NOT NULL,
  visa_manager text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fridge_slot_check CHECK (slot IN ('07h', '16h', '00h')),
  CONSTRAINT fridge_unique UNIQUE (control_date, slot, equipment_code)
);

ALTER TABLE public.fridge_temperatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select fridge" ON public.fridge_temperatures
  FOR SELECT USING (has_permission(auth.uid(), 'view_temperatures'));
CREATE POLICY "auth insert fridge" ON public.fridge_temperatures
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'edit_temperatures'));
CREATE POLICY "auth update fridge" ON public.fridge_temperatures
  FOR UPDATE USING (has_permission(auth.uid(), 'edit_temperatures'));
CREATE POLICY "auth delete fridge" ON public.fridge_temperatures
  FOR DELETE USING (has_permission(auth.uid(), 'delete_temperatures'));

CREATE TRIGGER update_fridge_temperatures_updated_at
  BEFORE UPDATE ON public.fridge_temperatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_fridge_date_slot ON public.fridge_temperatures (control_date, slot);
