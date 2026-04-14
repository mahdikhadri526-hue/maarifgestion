
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('alimentaire', 'emballage')),
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.initial_stocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.initial_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to initial_stocks" ON public.initial_stocks FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.lot_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  lot_number TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  remaining_quantity INTEGER NOT NULL DEFAULT 0,
  entry_date TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lot_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to lot_entries" ON public.lot_entries FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.requisitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('salle', 'emporter')),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to requisitions" ON public.requisitions FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_initial_stocks_updated_at
  BEFORE UPDATE ON public.initial_stocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.initial_stocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lot_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.requisitions;
