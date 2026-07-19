
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS require_deal_approval boolean NOT NULL DEFAULT false;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS approval_requested_by uuid,
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_approval_status_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_approval_status_check
  CHECK (approval_status IN ('not_required','pending','approved','changes_requested'));
