ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS brief_mode text NOT NULL DEFAULT 'platform';

CREATE TABLE public.event_brief_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL DEFAULT '',
  file_url text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_brief_templates TO authenticated;
GRANT ALL ON public.event_brief_templates TO service_role;

ALTER TABLE public.event_brief_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view brief templates"
ON public.event_brief_templates FOR SELECT TO authenticated
USING (public.is_member_of(auth.uid(), company_id));

CREATE POLICY "Editors can insert brief templates"
ON public.event_brief_templates FOR INSERT TO authenticated
WITH CHECK (public.has_permission(company_id, 'event_briefs', 'edit'));

CREATE POLICY "Editors can update brief templates"
ON public.event_brief_templates FOR UPDATE TO authenticated
USING (public.has_permission(company_id, 'event_briefs', 'edit'))
WITH CHECK (public.has_permission(company_id, 'event_briefs', 'edit'));

CREATE POLICY "Editors can delete brief templates"
ON public.event_brief_templates FOR DELETE TO authenticated
USING (public.has_permission(company_id, 'event_briefs', 'edit'));

CREATE TRIGGER event_brief_templates_updated_at
BEFORE UPDATE ON public.event_brief_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_event_brief_templates_company ON public.event_brief_templates(company_id);