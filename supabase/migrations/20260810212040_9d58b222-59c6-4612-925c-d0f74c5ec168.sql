CREATE TABLE public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  company text NOT NULL,
  email text NOT NULL,
  phone text,
  events_per_month text,
  message text,
  consent boolean NOT NULL DEFAULT false,
  source text DEFAULT 'landing',
  locale text
);

GRANT INSERT ON public.marketing_leads TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.marketing_leads TO authenticated;
GRANT ALL ON public.marketing_leads TO service_role;

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a marketing lead"
  ON public.marketing_leads FOR INSERT TO anon, authenticated
  WITH CHECK (consent = true);

CREATE POLICY "Platform admins manage marketing leads"
  ON public.marketing_leads FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());