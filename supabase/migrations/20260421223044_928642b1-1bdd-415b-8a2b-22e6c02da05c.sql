INSERT INTO public.initial_stocks (
  product_id,
  quantity,
  unit,
  paquet_enabled,
  pieces_per_paquet,
  carton_enabled,
  pieces_per_carton
)
VALUES (
  'emb-34',
  0,
  'PIECE',
  true,
  100,
  false,
  1
)
ON CONFLICT (product_id) DO UPDATE
SET
  paquet_enabled = true,
  pieces_per_paquet = 100,
  updated_at = now();