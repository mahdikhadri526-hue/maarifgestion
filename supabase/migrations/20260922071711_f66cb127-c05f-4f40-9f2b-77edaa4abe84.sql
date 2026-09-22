ALTER TABLE public.weekly_transfers
  ADD COLUMN IF NOT EXISTS is_return boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_of_id uuid REFERENCES public.weekly_transfers(id) ON DELETE SET NULL;