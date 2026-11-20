ALTER TABLE public.fridge_slots ADD COLUMN pdv_id uuid REFERENCES public.pdvs(id) ON DELETE CASCADE;
ALTER TABLE public.fridge_slots DROP CONSTRAINT IF EXISTS fridge_slots_label_key;
CREATE UNIQUE INDEX fridge_slots_pdv_label_uniq ON public.fridge_slots (pdv_id, label) NULLS NOT DISTINCT;