GRANT UPDATE (quantity, opening_date, performed_by) ON public.stock_total_openings TO authenticated;
CREATE POLICY stock_total_openings_correct ON public.stock_total_openings FOR UPDATE TO authenticated
USING (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'))
WITH CHECK (public.can_access_pdv(auth.uid(), pdv_id) AND public.has_pdv_permission(auth.uid(), pdv_id, 'edit_remaining_stock'));
COMMENT ON TABLE public.stock_total_openings IS 'PDV/product starting totals, correctable by authorized stock editors; operational movements remain unchanged.';