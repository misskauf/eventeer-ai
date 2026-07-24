
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_deal_language text NOT NULL DEFAULT 'en'
  CHECK (default_deal_language IN ('en','de'));

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en','de'));

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS name_de text,
  ADD COLUMN IF NOT EXISTS long_description_de text;

ALTER TABLE public.fb_packages
  ADD COLUMN IF NOT EXISTS name_de text,
  ADD COLUMN IF NOT EXISTS long_description_de text;

ALTER TABLE public.extras
  ADD COLUMN IF NOT EXISTS name_de text,
  ADD COLUMN IF NOT EXISTS long_description_de text;

ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en','de'));
