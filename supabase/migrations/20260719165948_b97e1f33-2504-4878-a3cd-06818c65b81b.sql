
-- Add new stage
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'client_approved' BEFORE 'signed';

-- Contract templates (per company)
CREATE TABLE public.contract_templates (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view contract templates" ON public.contract_templates
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), company_id));
CREATE POLICY "Members can insert contract templates" ON public.contract_templates
  FOR INSERT TO authenticated WITH CHECK (public.is_member_of(auth.uid(), company_id));
CREATE POLICY "Members can update contract templates" ON public.contract_templates
  FOR UPDATE TO authenticated USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));
CREATE POLICY "Members can delete contract templates" ON public.contract_templates
  FOR DELETE TO authenticated USING (public.is_member_of(auth.uid(), company_id));
CREATE TRIGGER contract_templates_updated_at BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contracts (per deal)
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  template_name text NOT NULL DEFAULT '',
  rendered_body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view contracts" ON public.contracts
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), company_id));
CREATE POLICY "Members can insert contracts" ON public.contracts
  FOR INSERT TO authenticated WITH CHECK (public.is_member_of(auth.uid(), company_id));
CREATE POLICY "Members can update contracts" ON public.contracts
  FOR UPDATE TO authenticated USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));
CREATE POLICY "Members can delete contracts" ON public.contracts
  FOR DELETE TO authenticated USING (public.is_member_of(auth.uid(), company_id));
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
