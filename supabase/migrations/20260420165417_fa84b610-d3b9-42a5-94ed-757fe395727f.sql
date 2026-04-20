
-- Add multi-unit configuration to initial_stocks
ALTER TABLE public.initial_stocks
  ADD COLUMN IF NOT EXISTS carton_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paquet_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pieces_per_carton integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pieces_per_paquet integer NOT NULL DEFAULT 1;

-- Track which unit was used for each movement / requisition
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS unit_used text NOT NULL DEFAULT 'PIECE';

ALTER TABLE public.requisitions
  ADD COLUMN IF NOT EXISTS unit_used text NOT NULL DEFAULT 'PIECE';
