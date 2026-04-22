UPDATE public.initial_stocks
SET paquet_enabled = true,
    pieces_per_paquet = 100,
    updated_at = now()
WHERE product_id = 'emb-44';