
CREATE POLICY "Company members can view logos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos' AND public.is_member_of(auth.uid(), (storage.foldername(name))[1]::uuid));

CREATE POLICY "Company members can upload logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND public.is_member_of(auth.uid(), (storage.foldername(name))[1]::uuid));

CREATE POLICY "Company members can update logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND public.is_member_of(auth.uid(), (storage.foldername(name))[1]::uuid));

CREATE POLICY "Company members can delete logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND public.is_member_of(auth.uid(), (storage.foldername(name))[1]::uuid));
