
ALTER TABLE public.fee_config
  ADD COLUMN IF NOT EXISTS gratuity_type text NOT NULL DEFAULT 'service_charge',
  ADD COLUMN IF NOT EXISTS gratuity_mode text NOT NULL DEFAULT 'slider',
  ADD COLUMN IF NOT EXISTS gratuity_fixed_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gratuity_min_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gratuity_max_pct numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS gratuity_default_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gratuity_tax_rate_pct numeric NOT NULL DEFAULT 19;

ALTER TABLE public.fee_config
  DROP CONSTRAINT IF EXISTS fee_config_gratuity_type_check,
  ADD CONSTRAINT fee_config_gratuity_type_check CHECK (gratuity_type IN ('service_charge','tip'));

ALTER TABLE public.fee_config
  DROP CONSTRAINT IF EXISTS fee_config_gratuity_mode_check,
  ADD CONSTRAINT fee_config_gratuity_mode_check CHECK (gratuity_mode IN ('fixed','slider'));

-- Backfill from existing service_charge_pct
UPDATE public.fee_config
SET gratuity_fixed_pct = COALESCE(service_charge_pct, 0),
    gratuity_default_pct = COALESCE(service_charge_pct, 0)
WHERE gratuity_fixed_pct = 0 AND gratuity_default_pct = 0;
