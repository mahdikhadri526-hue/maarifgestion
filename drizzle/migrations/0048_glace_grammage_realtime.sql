DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='glace_grammage') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.glace_grammage;
  END IF;
END $$;