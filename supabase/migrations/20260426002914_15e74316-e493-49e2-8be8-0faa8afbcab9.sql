INSERT INTO public.initial_stocks (product_id, unit, paquet_enabled, pieces_per_paquet, carton_enabled, pieces_per_carton, quantity)
VALUES ('ali-12', 'PIECE', true, 100, false, 1, 0)
ON CONFLICT (product_id) DO UPDATE
SET paquet_enabled = true,
    pieces_per_paquet = 100,
    updated_at = now();