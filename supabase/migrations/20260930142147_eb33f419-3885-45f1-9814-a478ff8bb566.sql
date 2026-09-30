ALTER TABLE public.mise_en_place_stocks ADD COLUMN week_start date NOT NULL DEFAULT (date_trunc('week', now())::date);
ALTER TABLE public.mise_en_place_stocks DROP CONSTRAINT IF EXISTS mise_en_place_stocks_pdv_id_product_id_key;
ALTER TABLE public.mise_en_place_stocks ADD CONSTRAINT mise_en_place_stocks_pdv_product_week_key UNIQUE (pdv_id, product_id, week_start);