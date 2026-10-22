CREATE OR REPLACE FUNCTION public.guard_existing_packaging_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'product_catalog' THEN
    IF NEW.conditionnement IS DISTINCT FROM OLD.conditionnement THEN
      RAISE EXCEPTION 'Seul un administrateur peut modifier les conditionnements' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'initial_stocks' THEN
    IF NEW.carton_enabled IS DISTINCT FROM OLD.carton_enabled
       OR NEW.paquet_enabled IS DISTINCT FROM OLD.paquet_enabled
       OR NEW.pieces_per_carton IS DISTINCT FROM OLD.pieces_per_carton
       OR NEW.pieces_per_paquet IS DISTINCT FROM OLD.pieces_per_paquet THEN
      RAISE EXCEPTION 'Seul un administrateur peut modifier les conditionnements' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_catalog_packaging_admin BEFORE UPDATE ON public.product_catalog FOR EACH ROW EXECUTE FUNCTION public.guard_existing_packaging_admin();
CREATE TRIGGER guard_stock_packaging_admin BEFORE UPDATE ON public.initial_stocks FOR EACH ROW EXECUTE FUNCTION public.guard_existing_packaging_admin();