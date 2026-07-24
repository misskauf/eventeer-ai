
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS invoice_mode TEXT NOT NULL DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS invoice_notes TEXT;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_invoice_mode_check
  CHECK (invoice_mode IN ('external','template'));

CREATE TABLE public.invoice_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_templates TO authenticated;
GRANT ALL ON public.invoice_templates TO service_role;
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage invoice templates"
  ON public.invoice_templates FOR ALL
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

CREATE TRIGGER trg_invoice_templates_updated_at
  BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.invoice_templates(id) ON DELETE SET NULL,
  template_name TEXT,
  body_html TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'template',
  status TEXT NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_mode_check CHECK (mode IN ('external','template')),
  CONSTRAINT invoices_status_check CHECK (status IN ('draft','sent','done'))
);
CREATE INDEX invoices_deal_id_idx ON public.invoices(deal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage invoices"
  ON public.invoices FOR ALL
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
