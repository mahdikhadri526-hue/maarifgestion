ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS source text;
CREATE INDEX IF NOT EXISTS idx_stock_movements_source ON public.stock_movements(source);