ALTER TABLE public.planning ADD COLUMN IF NOT EXISTS matricule text, ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE public.attendance_agents ADD COLUMN IF NOT EXISTS matricule text;

UPDATE public.planning p
SET hire_date = a.hire_date
FROM public.attendance_agents a
WHERE p.agent_id = a.id AND p.hire_date IS NULL AND a.hire_date IS NOT NULL;