CREATE UNIQUE INDEX IF NOT EXISTS weekly_tracking_materiel_unique
ON public.weekly_tracking (fiche_type, week_start, day_of_week, row_index, article)
WHERE fiche_type = 'Suivi Materiel';