ALTER TABLE public.pep_tasks ADD COLUMN IF NOT EXISTS requires_photo_before_after boolean NOT NULL DEFAULT false;
ALTER TABLE public.pep_occurrences ADD COLUMN IF NOT EXISTS photo_before_url text;