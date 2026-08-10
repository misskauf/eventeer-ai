ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS deals_company_archived_idx ON public.deals (company_id, archived_at);

DROP POLICY IF EXISTS "Deals admin can delete" ON public.deals;
CREATE POLICY "Deals admin can delete"
ON public.deals FOR DELETE
TO authenticated
USING (public.has_permission(company_id, 'deals', 'admin'));