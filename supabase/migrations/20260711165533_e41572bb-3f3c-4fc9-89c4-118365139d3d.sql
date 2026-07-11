
ALTER TABLE public.fb_packages
  ADD COLUMN IF NOT EXISTS selection_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS selection_groups jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.fb_packages
  DROP CONSTRAINT IF EXISTS fb_packages_selection_mode_chk;
ALTER TABLE public.fb_packages
  ADD CONSTRAINT fb_packages_selection_mode_chk
  CHECK (selection_mode IN ('fixed','single_group','multi_group'));

ALTER TABLE public.proposal_selections
  ADD COLUMN IF NOT EXISTS menu_choices jsonb NOT NULL DEFAULT '{}'::jsonb;
