UPDATE public.initial_stocks
SET pieces_per_paquet = 50,
    paquet_enabled = true,
    updated_at = now()
WHERE product_id = 'emb-36';