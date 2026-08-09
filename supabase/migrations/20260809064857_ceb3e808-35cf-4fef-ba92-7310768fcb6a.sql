CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
       OR lower(pa.email) = lower(COALESCE(
            (auth.jwt() ->> 'email'),
            (auth.jwt() -> 'user_metadata' ->> 'email'),
            ''))
  )
$$;

CREATE POLICY "Platform admins read admin list"
ON public.platform_admins FOR SELECT TO authenticated
USING (public.is_platform_admin());

INSERT INTO public.platform_admins (email, user_id)
SELECT 'kauf.keren@gmail.com', (SELECT id FROM auth.users WHERE lower(email) = 'kauf.keren@gmail.com' LIMIT 1)
ON CONFLICT (email) DO NOTHING;

CREATE TABLE public.platform_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.platform_audit TO authenticated;
GRANT ALL ON public.platform_audit TO service_role;
ALTER TABLE public.platform_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read audit"
ON public.platform_audit FOR SELECT TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "Platform admins write audit"
ON public.platform_audit FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin() AND actor_id = auth.uid());

CREATE INDEX platform_audit_company_idx ON public.platform_audit (company_id, created_at DESC);

CREATE POLICY "Platform admins read all companies"
ON public.companies FOR SELECT TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "Platform admins update billing state"
ON public.companies FOR UPDATE TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());