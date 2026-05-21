CREATE UNIQUE INDEX IF NOT EXISTS weekly_tracking_unique_cell
ON public.weekly_tracking (
  fiche_type,
  week_start,
  day_of_week,
  row_index,
  COALESCE(article, '')
);