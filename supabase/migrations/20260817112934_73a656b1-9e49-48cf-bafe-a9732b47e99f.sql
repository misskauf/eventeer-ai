CREATE TABLE public.followup_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('proposal','contract','invoice')),
  enabled boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'notify' CHECK (mode IN ('auto','notify')),
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','both')),
  interval_days integer NOT NULL DEFAULT 5 CHECK (interval_days BETWEEN 1 AND 180),
  max_reminders integer CHECK (max_reminders IS NULL OR max_reminders BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_configs TO authenticated;
GRANT ALL ON public.followup_configs TO service_role;

ALTER TABLE public.followup_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view follow-up configs"
ON public.followup_configs FOR SELECT TO authenticated
USING (public.is_member_of(auth.uid(), company_id));

CREATE POLICY "Settings editors can insert follow-up configs"
ON public.followup_configs FOR INSERT TO authenticated
WITH CHECK (public.has_permission(company_id, 'settings', 'edit'));

CREATE POLICY "Settings editors can update follow-up configs"
ON public.followup_configs FOR UPDATE TO authenticated
USING (public.has_permission(company_id, 'settings', 'edit'))
WITH CHECK (public.has_permission(company_id, 'settings', 'edit'));

CREATE POLICY "Settings editors can delete follow-up configs"
ON public.followup_configs FOR DELETE TO authenticated
USING (public.has_permission(company_id, 'settings', 'edit'));

CREATE TRIGGER followup_configs_updated_at
BEFORE UPDATE ON public.followup_configs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.followup_configs (company_id, doc_type, enabled, mode, channel, interval_days)
SELECT c.id, 'proposal', true, 'notify', 'in_app', GREATEST(LEAST(COALESCE(c.proposal_reminder_days, 5), 180), 1)
FROM public.companies c
ON CONFLICT (company_id, doc_type) DO NOTHING;

INSERT INTO public.followup_configs (company_id, doc_type, enabled, mode, channel, interval_days)
SELECT c.id, 'contract', true, 'notify', 'in_app', 7
FROM public.companies c
ON CONFLICT (company_id, doc_type) DO NOTHING;

CREATE TABLE public.job_leases (
  job_name text PRIMARY KEY,
  locked_until timestamptz NOT NULL,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.job_leases TO service_role;

ALTER TABLE public.job_leases ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER job_leases_updated_at
BEFORE UPDATE ON public.job_leases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();