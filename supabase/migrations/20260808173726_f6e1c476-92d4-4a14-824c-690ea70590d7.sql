ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_note text;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_subscription_status_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_subscription_status_check
  CHECK (subscription_status IN ('trialing','active','expired','comped'));

UPDATE public.companies
   SET subscription_status = 'active',
       activated_at = COALESCE(activated_at, now());

CREATE OR REPLACE FUNCTION public.create_company_workspace(_name text, _primary_color text, _currency text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.companies (name, primary_color, currency, created_by, subscription_status, trial_ends_at)
  VALUES (_name, COALESCE(NULLIF(_primary_color, ''), '#0f172a'), COALESCE(NULLIF(_currency, ''), 'USD'), _uid, 'trialing', now() + interval '60 days')
  RETURNING id INTO _company_id;

  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (_uid, _company_id, 'owner');

  INSERT INTO public.fee_config (company_id) VALUES (_company_id);

  PERFORM public.seed_role_permissions(_company_id);

  RETURN _company_id;
END;
$function$;