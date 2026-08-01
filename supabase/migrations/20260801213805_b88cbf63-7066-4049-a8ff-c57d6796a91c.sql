CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  metric text NOT NULL CHECK (metric IN ('net_revenue','gross_revenue')),
  period_type text NOT NULL CHECK (period_type IN ('month','quarter','year')),
  period_start date NOT NULL,
  target numeric NOT NULL DEFAULT 0,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX goals_unique_scope ON public.goals (
  company_id, metric, period_type, period_start,
  COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(space_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE POLICY "Analytics viewers can read goals"
ON public.goals FOR SELECT TO authenticated
USING (public.has_permission(company_id, 'analytics', 'view'));

CREATE POLICY "Settings editors can insert goals"
ON public.goals FOR INSERT TO authenticated
WITH CHECK (public.has_permission(company_id, 'settings', 'edit'));

CREATE POLICY "Settings editors can update goals"
ON public.goals FOR UPDATE TO authenticated
USING (public.has_permission(company_id, 'settings', 'edit'))
WITH CHECK (public.has_permission(company_id, 'settings', 'edit'));

CREATE POLICY "Settings editors can delete goals"
ON public.goals FOR DELETE TO authenticated
USING (public.has_permission(company_id, 'settings', 'edit'));

CREATE TRIGGER goals_set_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();