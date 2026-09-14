ALTER TABLE public.hr_schedules
  ADD COLUMN IF NOT EXISTS work_shift text;

ALTER TABLE public.hr_schedules
  DROP CONSTRAINT IF EXISTS hr_schedules_work_shift_check;

ALTER TABLE public.hr_schedules
  ADD CONSTRAINT hr_schedules_work_shift_check
  CHECK (work_shift IS NULL OR work_shift IN ('matin', 'apres_midi'));