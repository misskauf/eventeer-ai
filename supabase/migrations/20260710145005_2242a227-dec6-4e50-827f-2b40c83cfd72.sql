
CREATE OR REPLACE FUNCTION public.create_company_workspace(
  _name text,
  _primary_color text,
  _currency text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.companies (name, primary_color, currency, created_by)
  VALUES (_name, COALESCE(NULLIF(_primary_color, ''), '#0f172a'), COALESCE(NULLIF(_currency, ''), 'USD'), _uid)
  RETURNING id INTO _company_id;

  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (_uid, _company_id, 'owner');

  INSERT INTO public.fee_config (company_id) VALUES (_company_id);

  RETURN _company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_workspace(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_workspace(text, text, text) TO authenticated;
