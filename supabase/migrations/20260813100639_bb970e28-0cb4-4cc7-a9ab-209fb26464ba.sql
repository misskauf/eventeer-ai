ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_coupon_id text;

CREATE TABLE IF NOT EXISTS public.platform_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id text NOT NULL UNIQUE,
  label text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  interval text NOT NULL DEFAULT 'month',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.platform_prices TO service_role;

ALTER TABLE public.platform_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage prices"
  ON public.platform_prices FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE TRIGGER platform_prices_updated_at
  BEFORE UPDATE ON public.platform_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();