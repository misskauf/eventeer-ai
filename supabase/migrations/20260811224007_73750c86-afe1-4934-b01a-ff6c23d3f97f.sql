ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_url text,
  ADD COLUMN IF NOT EXISTS stripe_url_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.company_stripe_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  secret_key_encrypted text NOT NULL,
  secret_key_last4 text NOT NULL,
  mode text NOT NULL DEFAULT 'test',
  webhook_secret_encrypted text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service role only: no grants to anon or authenticated.
GRANT ALL ON public.company_stripe_credentials TO service_role;

ALTER TABLE public.company_stripe_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages stripe credentials"
  ON public.company_stripe_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER company_stripe_credentials_updated_at
  BEFORE UPDATE ON public.company_stripe_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();