CREATE TABLE public.dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dashboard_layouts_company_user_key
  ON public.dashboard_layouts (company_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_layouts TO authenticated;
GRANT ALL ON public.dashboard_layouts TO service_role;

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own layout and company default"
  ON public.dashboard_layouts FOR SELECT TO authenticated
  USING (
    public.is_member_of(auth.uid(), company_id)
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Members insert own layout"
  ON public.dashboard_layouts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(auth.uid(), company_id)
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND public.has_permission(company_id, 'settings', 'admin'))
    )
  );

CREATE POLICY "Members update own layout"
  ON public.dashboard_layouts FOR UPDATE TO authenticated
  USING (
    public.is_member_of(auth.uid(), company_id)
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND public.has_permission(company_id, 'settings', 'admin'))
    )
  )
  WITH CHECK (
    public.is_member_of(auth.uid(), company_id)
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND public.has_permission(company_id, 'settings', 'admin'))
    )
  );

CREATE POLICY "Members delete own layout"
  ON public.dashboard_layouts FOR DELETE TO authenticated
  USING (
    public.is_member_of(auth.uid(), company_id)
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND public.has_permission(company_id, 'settings', 'admin'))
    )
  );

CREATE TRIGGER dashboard_layouts_set_updated_at
  BEFORE UPDATE ON public.dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
