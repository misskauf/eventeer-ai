
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'sales');
CREATE TYPE public.deal_stage AS ENUM ('inquiry', 'proposal_draft', 'proposal_sent', 'client_selected', 'manager_review', 'accepted', 'lost');
CREATE TYPE public.extra_pricing_type AS ENUM ('per_person', 'flat', 'per_hour');
CREATE TYPE public.share_token_kind AS ENUM ('client_proposal', 'dashboard');

-- ===== UPDATED_AT TRIGGER =====
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===== COMPANIES =====
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0f172a',
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== USER_ROLES (membership + role) =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_company ON public.user_roles(company_id);

-- Security-definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.user_company_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = _company_id);
$$;

-- companies policies
CREATE POLICY "members view their company" ON public.companies FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), id));
CREATE POLICY "creator inserts company" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "members update company" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_member_of(auth.uid(), id));

-- user_roles policies
CREATE POLICY "users see roles in their company" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), company_id));

-- ===== CATALOG: SPACES =====
CREATE TABLE public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  capacity INT NOT NULL DEFAULT 0,
  base_rental_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_rental_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  photo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spaces TO authenticated;
GRANT ALL ON public.spaces TO service_role;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_spaces_company ON public.spaces(company_id);
CREATE TRIGGER trg_spaces_updated_at BEFORE UPDATE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "members manage spaces" ON public.spaces FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== CATALOG: F&B PACKAGES =====
CREATE TABLE public.fb_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'dinner',
  description TEXT,
  price_per_person NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_guests INT NOT NULL DEFAULT 0,
  allergen_notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_packages TO authenticated;
GRANT ALL ON public.fb_packages TO service_role;
ALTER TABLE public.fb_packages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fb_company ON public.fb_packages(company_id);
CREATE TRIGGER trg_fb_updated_at BEFORE UPDATE ON public.fb_packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "members manage fb" ON public.fb_packages FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== CATALOG: EXTRAS =====
CREATE TABLE public.extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  pricing_type public.extra_pricing_type NOT NULL DEFAULT 'flat',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extras TO authenticated;
GRANT ALL ON public.extras TO service_role;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_extras_company ON public.extras(company_id);
CREATE TRIGGER trg_extras_updated_at BEFORE UPDATE ON public.extras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "members manage extras" ON public.extras FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== FEE CONFIG (one per company) =====
CREATE TABLE public.fee_config (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  service_charge_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  cleaning_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime_fee_per_hour NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_config TO authenticated;
GRANT ALL ON public.fee_config TO service_role;
ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_fee_updated_at BEFORE UPDATE ON public.fee_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "members manage fees" ON public.fee_config FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== PRICING SEASONS =====
CREATE TABLE public.pricing_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_seasons TO authenticated;
GRANT ALL ON public.pricing_seasons TO service_role;
ALTER TABLE public.pricing_seasons ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_seasons_company ON public.pricing_seasons(company_id);
CREATE POLICY "members manage seasons" ON public.pricing_seasons FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== PRICING RULES: day-of-week min revenue per space =====
-- day_of_week: 0=Sunday .. 6=Saturday; month: 1-12 or NULL for any
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  month INT CHECK (month BETWEEN 1 AND 12),
  min_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rules_company ON public.pricing_rules(company_id);
CREATE POLICY "members manage rules" ON public.pricing_rules FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== DEALS =====
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_company TEXT,
  event_type TEXT,
  event_date DATE,
  guest_count INT NOT NULL DEFAULT 0,
  stage public.deal_stage NOT NULL DEFAULT 'inquiry',
  notes TEXT,
  estimated_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deals_company ON public.deals(company_id);
CREATE INDEX idx_deals_stage ON public.deals(company_id, stage);
CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "members manage deals" ON public.deals FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== PROPOSALS (versioned JSON snapshot) =====
-- offer: { spaces:[...], packages:[...], extras:[...], fees:{...} }
-- constraints: { guest_min, guest_max, swappable_package_ids, optional_extras }
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  offer JSONB NOT NULL DEFAULT '{}'::jsonb,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_proposals_deal ON public.proposals(deal_id);
CREATE POLICY "members manage proposals" ON public.proposals FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== PROPOSAL SELECTIONS (what client picked) =====
CREATE TABLE public.proposal_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  selection JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_selections TO authenticated;
GRANT ALL ON public.proposal_selections TO service_role;
ALTER TABLE public.proposal_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view selections" ON public.proposal_selections FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== DEAL ACTIVITY LOG =====
CREATE TABLE public.deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_activities TO authenticated;
GRANT ALL ON public.deal_activities TO service_role;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_activities_deal ON public.deal_activities(deal_id, created_at DESC);
CREATE POLICY "members view activities" ON public.deal_activities FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- ===== SHARE TOKENS (magic links) =====
CREATE TABLE public.share_tokens (
  token TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind public.share_token_kind NOT NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_tokens TO authenticated;
GRANT ALL ON public.share_tokens TO service_role;
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_share_deal ON public.share_tokens(deal_id);
CREATE POLICY "members manage tokens" ON public.share_tokens FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));
