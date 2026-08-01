CREATE TABLE public.event_briefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL UNIQUE REFERENCES public.deals(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  generated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_briefs TO authenticated;
GRANT ALL ON public.event_briefs TO service_role;

ALTER TABLE public.event_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their company briefs"
ON public.event_briefs FOR SELECT TO authenticated
USING (public.is_member_of(auth.uid(), company_id));

CREATE POLICY "Members can create their company briefs"
ON public.event_briefs FOR INSERT TO authenticated
WITH CHECK (public.is_member_of(auth.uid(), company_id));

CREATE POLICY "Members can update their company briefs"
ON public.event_briefs FOR UPDATE TO authenticated
USING (public.is_member_of(auth.uid(), company_id))
WITH CHECK (public.is_member_of(auth.uid(), company_id));

CREATE POLICY "Members can delete their company briefs"
ON public.event_briefs FOR DELETE TO authenticated
USING (public.is_member_of(auth.uid(), company_id));

CREATE TRIGGER set_event_briefs_updated_at
BEFORE UPDATE ON public.event_briefs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_event_briefs_company ON public.event_briefs(company_id);