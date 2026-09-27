ALTER TABLE public.pdv_shift_times ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'manager';
ALTER TABLE public.pdv_shift_times DROP CONSTRAINT IF EXISTS pdv_shift_times_role_chk;
ALTER TABLE public.pdv_shift_times ADD CONSTRAINT pdv_shift_times_role_chk CHECK (role IN ('manager', 'caissier'));
DROP INDEX IF EXISTS public.pdv_shift_times_pdv_shift_dow_key;
CREATE UNIQUE INDEX IF NOT EXISTS pdv_shift_times_pdv_shift_dow_role_key ON public.pdv_shift_times (pdv_id, shift, day_of_week, role);