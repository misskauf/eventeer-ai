
-- lead_forms table
CREATE TABLE public.lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  intro_text text,
  success_text text,
  redirect_url text,
  consent_text text NOT NULL DEFAULT 'I agree to be contacted about my event inquiry and to the processing of my data per the privacy policy.',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug)
);

CREATE INDEX idx_lead_forms_company ON public.lead_forms(company_id);
CREATE INDEX idx_lead_forms_slug_active ON public.lead_forms(slug) WHERE active;

GRANT SELECT ON public.lead_forms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_forms TO authenticated;
GRANT ALL ON public.lead_forms TO service_role;

ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage lead_forms" ON public.lead_forms
  FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

CREATE POLICY "public can read active lead_forms" ON public.lead_forms
  FOR SELECT TO anon
  USING (active = true);

CREATE TRIGGER trg_lead_forms_updated_at
  BEFORE UPDATE ON public.lead_forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- deals: source + consent tracking
ALTER TABLE public.deals
  ADD COLUMN source text NOT NULL DEFAULT 'manual',
  ADD COLUMN lead_form_id uuid REFERENCES public.lead_forms(id) ON DELETE SET NULL,
  ADD COLUMN consent_text text,
  ADD COLUMN consent_given_at timestamptz;
