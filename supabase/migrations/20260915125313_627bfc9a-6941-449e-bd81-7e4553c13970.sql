ALTER TABLE public.pdv_shift_times ADD COLUMN IF NOT EXISTS day_of_week integer;

ALTER TABLE public.pdv_shift_times DROP CONSTRAINT IF EXISTS pdv_shift_times_pdv_id_shift_key;
DROP INDEX IF EXISTS pdv_shift_times_pdv_id_shift_key;

-- dupliquer les horaires existants sur les 7 jours
INSERT INTO public.pdv_shift_times (pdv_id, shift, start_time, end_time, day_of_week)
SELECT t.pdv_id, t.shift, t.start_time, t.end_time, d
FROM public.pdv_shift_times t
CROSS JOIN generate_series(1, 7) AS d
WHERE t.day_of_week IS NULL;

DELETE FROM public.pdv_shift_times WHERE day_of_week IS NULL;

ALTER TABLE public.pdv_shift_times ALTER COLUMN day_of_week SET NOT NULL;
ALTER TABLE public.pdv_shift_times ADD CONSTRAINT pdv_shift_times_dow_chk CHECK (day_of_week BETWEEN 1 AND 7);

CREATE UNIQUE INDEX IF NOT EXISTS pdv_shift_times_pdv_shift_dow_key
  ON public.pdv_shift_times (pdv_id, shift, day_of_week);