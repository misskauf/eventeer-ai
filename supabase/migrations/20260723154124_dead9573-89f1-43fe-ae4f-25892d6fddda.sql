
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_company_created ON public.notifications(company_id, created_at DESC);
CREATE INDEX idx_notifications_recipient_read ON public.notifications(recipient_user_id, read_at);
CREATE INDEX idx_notifications_deal ON public.notifications(deal_id);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view own or company notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    public.is_member_of(auth.uid(), company_id)
    AND (recipient_user_id IS NULL OR recipient_user_id = auth.uid())
  );

CREATE POLICY "members mark own or company notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    public.is_member_of(auth.uid(), company_id)
    AND (recipient_user_id IS NULL OR recipient_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_member_of(auth.uid(), company_id)
    AND (recipient_user_id IS NULL OR recipient_user_id = auth.uid())
  );
