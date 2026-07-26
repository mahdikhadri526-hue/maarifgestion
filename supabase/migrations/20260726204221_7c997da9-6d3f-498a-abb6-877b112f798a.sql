DROP INDEX IF EXISTS public.weekly_tracking_materiel_unique;
CREATE UNIQUE INDEX IF NOT EXISTS weekly_tracking_conflict_key
ON public.weekly_tracking (fiche_type, week_start, day_of_week, row_index, article);