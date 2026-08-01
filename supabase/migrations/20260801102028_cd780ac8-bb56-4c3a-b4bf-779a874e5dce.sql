CREATE TABLE public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_de text,
  category text NOT NULL DEFAULT 'staff',
  description text,
  long_description text,
  long_description_de text,
  pricing_type public.extra_pricing_type NOT NULL DEFAULT 'per_hour',
  price numeric NOT NULL DEFAULT 0,
  basis text,
  tax_rate_pct numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_roles TO authenticated;
GRANT ALL ON public.staff_roles TO service_role;

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their company staff roles"
ON public.staff_roles FOR ALL TO authenticated
USING (public.is_member_of(auth.uid(), company_id))
WITH CHECK (public.is_member_of(auth.uid(), company_id));

CREATE TRIGGER staff_roles_set_updated_at
BEFORE UPDATE ON public.staff_roles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX staff_roles_company_id_idx ON public.staff_roles(company_id);

ALTER TABLE public.fee_config
  ADD COLUMN IF NOT EXISTS default_basis_staff text NOT NULL DEFAULT 'net',
  ADD COLUMN IF NOT EXISTS tax_rate_staff numeric NOT NULL DEFAULT 0;