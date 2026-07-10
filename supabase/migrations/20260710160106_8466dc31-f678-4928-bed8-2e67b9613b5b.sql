
ALTER TABLE public.fee_config
  ADD COLUMN IF NOT EXISTS default_hours_food numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS default_hours_beverage numeric NOT NULL DEFAULT 4;

ALTER TABLE public.fb_packages
  ADD COLUMN IF NOT EXISTS included_hours numeric,
  ADD COLUMN IF NOT EXISTS overage_price_per_person_per_hour numeric NOT NULL DEFAULT 0;
