ALTER POLICY "tech videos read" ON storage.objects TO authenticated USING (
  bucket_id = 'tech-videos'
  AND auth.uid() IS NOT NULL
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.tech_issues AS issue
      WHERE (
        issue.photo_url = 'storage:tech-videos/' || storage.objects.name
        OR issue.repair_photo_url = 'storage:tech-videos/' || storage.objects.name
        OR (left(ltrim(issue.photo_url), 1) = '[' AND position(to_json('storage:tech-videos/' || storage.objects.name)::text IN issue.photo_url) > 0)
        OR (left(ltrim(issue.repair_photo_url), 1) = '[' AND position(to_json('storage:tech-videos/' || storage.objects.name)::text IN issue.repair_photo_url) > 0)
      )
    )
  )
);
COMMENT ON POLICY "tech videos read" ON storage.objects IS 'Read only own uploads or videos referenced by a tech issue visible through its existing row-level access policies. Upload rules are unchanged.';