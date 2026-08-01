ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS quote_format text NOT NULL DEFAULT '{venue}-{YYYY}-{seq}',
  ADD COLUMN IF NOT EXISTS venue_code text,
  ADD COLUMN IF NOT EXISTS quote_next_seq integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quote_seq_padding integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS quote_reset_yearly boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quote_seq_year integer;

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS quote_number text;

CREATE UNIQUE INDEX IF NOT EXISTS proposals_company_quote_number_key
  ON public.proposals (company_id, quote_number)
  WHERE quote_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.next_quote_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c record;
  _seq integer;
  _year integer := EXTRACT(YEAR FROM now())::int;
  _out text;
BEGIN
  IF NOT public.has_permission(_company_id, 'proposals', 'edit') THEN
    RAISE EXCEPTION 'Forbidden: proposals requires edit access';
  END IF;

  SELECT * INTO c FROM public.companies WHERE id = _company_id FOR UPDATE;
  IF c IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  IF c.quote_reset_yearly AND (c.quote_seq_year IS NULL OR c.quote_seq_year <> _year) THEN
    _seq := 1;
  ELSE
    _seq := GREATEST(COALESCE(c.quote_next_seq, 1), 1);
  END IF;

  _out := COALESCE(NULLIF(c.quote_format, ''), '{venue}-{YYYY}-{seq}');
  _out := replace(_out, '{venue}', COALESCE(c.venue_code, ''));
  _out := replace(_out, '{YYYY}', to_char(now(), 'YYYY'));
  _out := replace(_out, '{YY}', to_char(now(), 'YY'));
  _out := replace(_out, '{MM}', to_char(now(), 'MM'));
  _out := replace(_out, '{seq}', lpad(_seq::text, GREATEST(COALESCE(c.quote_seq_padding, 4), 1), '0'));
  _out := regexp_replace(_out, '-{2,}', '-', 'g');
  _out := btrim(_out, '-');

  UPDATE public.companies
     SET quote_next_seq = _seq + 1,
         quote_seq_year = _year,
         updated_at = now()
   WHERE id = _company_id;

  RETURN _out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_quote_number(uuid) TO authenticated;