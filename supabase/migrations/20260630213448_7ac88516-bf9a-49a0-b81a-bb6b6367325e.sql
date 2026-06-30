
-- 1) Tighten inventory_sessions UPDATE policy to managers only
DROP POLICY IF EXISTS "inv sessions update manager or counter done" ON public.inventory_sessions;
CREATE POLICY "inv sessions update manager only"
  ON public.inventory_sessions
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_inventory(auth.uid()))
  WITH CHECK (public.can_manage_inventory(auth.uid()));

-- RPC for counters to mark themselves done (only their own slot, only during counting)
CREATE OR REPLACE FUNCTION public.inv_mark_counter_done(_session_id uuid, _slot text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.inventory_sessions%ROWTYPE;
BEGIN
  IF _slot NOT IN ('A','B') THEN
    RAISE EXCEPTION 'Slot invalide';
  END IF;
  SELECT * INTO s FROM public.inventory_sessions WHERE id = _session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session introuvable';
  END IF;
  IF s.status <> 'counting' THEN
    RAISE EXCEPTION 'Session non en cours de comptage';
  END IF;
  IF _slot = 'A' THEN
    IF s.counter_a_user_id IS DISTINCT FROM auth.uid() AND NOT public.can_manage_inventory(auth.uid()) THEN
      RAISE EXCEPTION 'Non autorisé';
    END IF;
    UPDATE public.inventory_sessions SET counter_a_done = true WHERE id = _session_id;
  ELSE
    IF s.counter_b_user_id IS DISTINCT FROM auth.uid() AND NOT public.can_manage_inventory(auth.uid()) THEN
      RAISE EXCEPTION 'Non autorisé';
    END IF;
    UPDATE public.inventory_sessions SET counter_b_done = true WHERE id = _session_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.inv_mark_counter_done(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inv_mark_counter_done(uuid, text) TO authenticated, service_role;

-- 2) Revoke anonymous EXECUTE on SECURITY DEFINER helper functions
REVOKE EXECUTE ON FUNCTION public.can_manage_inventory(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_participate_inventory(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inventory_session_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_inventory(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_participate_inventory(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inventory_session_status(uuid) TO authenticated, service_role;

-- 3) Restrict realtime topics for inventory channels (broadcast/presence + postgres_changes)
-- Topics used by the app: inv-counting-<uuid>, inv-recon-<uuid>, inv-sessions-list
DROP POLICY IF EXISTS "inv realtime topics access" ON realtime.messages;
CREATE POLICY "inv realtime topics access"
  ON realtime.messages
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'inv-sessions-list%' THEN
        public.can_manage_inventory(auth.uid())
        OR public.has_permission(auth.uid(), 'view_inventory')
      WHEN realtime.topic() LIKE 'inv-counting-%' OR realtime.topic() LIKE 'inv-recon-%' THEN
        public.can_manage_inventory(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.inventory_sessions s
          WHERE s.id::text = split_part(realtime.topic(), '-', 3)
            AND (s.counter_a_user_id = auth.uid() OR s.counter_b_user_id = auth.uid())
        )
      ELSE true
    END
  );
