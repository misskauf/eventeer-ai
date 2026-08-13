CREATE TABLE public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  terms_version text NOT NULL,
  document text NOT NULL DEFAULT 'agb+avv'
);

GRANT SELECT, INSERT ON public.terms_acceptances TO authenticated;
GRANT ALL ON public.terms_acceptances TO service_role;

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own acceptance"
  ON public.terms_acceptances FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view their own acceptances"
  ON public.terms_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX terms_acceptances_user_id_idx ON public.terms_acceptances (user_id);