ALTER TYPE deal_stage ADD VALUE IF NOT EXISTS 'changes_requested';
ALTER TABLE public.proposal_selections ADD COLUMN IF NOT EXISTS client_action text;