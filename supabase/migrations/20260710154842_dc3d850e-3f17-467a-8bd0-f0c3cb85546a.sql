
-- Packages: split food/beverage, tax fields, long description
ALTER TABLE public.fb_packages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'food',
  ADD COLUMN IF NOT EXISTS basis text,
  ADD COLUMN IF NOT EXISTS tax_rate_pct numeric,
  ADD COLUMN IF NOT EXISTS long_description text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fb_packages_kind_check') THEN
    ALTER TABLE public.fb_packages ADD CONSTRAINT fb_packages_kind_check CHECK (kind IN ('food','beverage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fb_packages_basis_check') THEN
    ALTER TABLE public.fb_packages ADD CONSTRAINT fb_packages_basis_check CHECK (basis IS NULL OR basis IN ('net','gross'));
  END IF;
END $$;

-- Extras
ALTER TABLE public.extras
  ADD COLUMN IF NOT EXISTS basis text,
  ADD COLUMN IF NOT EXISTS tax_rate_pct numeric,
  ADD COLUMN IF NOT EXISTS long_description text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extras_basis_check') THEN
    ALTER TABLE public.extras ADD CONSTRAINT extras_basis_check CHECK (basis IS NULL OR basis IN ('net','gross'));
  END IF;
END $$;

-- Spaces
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS basis text,
  ADD COLUMN IF NOT EXISTS tax_rate_pct numeric,
  ADD COLUMN IF NOT EXISTS long_description text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spaces_basis_check') THEN
    ALTER TABLE public.spaces ADD CONSTRAINT spaces_basis_check CHECK (basis IS NULL OR basis IN ('net','gross'));
  END IF;
END $$;

-- fee_config: category defaults
ALTER TABLE public.fee_config
  ADD COLUMN IF NOT EXISTS default_basis_food text NOT NULL DEFAULT 'net',
  ADD COLUMN IF NOT EXISTS tax_rate_food numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_basis_beverage text NOT NULL DEFAULT 'net',
  ADD COLUMN IF NOT EXISTS tax_rate_beverage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_basis_extra text NOT NULL DEFAULT 'net',
  ADD COLUMN IF NOT EXISTS tax_rate_extra numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_basis_rental text NOT NULL DEFAULT 'net',
  ADD COLUMN IF NOT EXISTS tax_rate_rental numeric NOT NULL DEFAULT 0;

-- Seed category tax rates from existing tax_pct so companies keep working numbers
UPDATE public.fee_config
SET tax_rate_food = COALESCE(NULLIF(tax_rate_food,0), tax_pct),
    tax_rate_beverage = COALESCE(NULLIF(tax_rate_beverage,0), tax_pct),
    tax_rate_extra = COALESCE(NULLIF(tax_rate_extra,0), tax_pct),
    tax_rate_rental = COALESCE(NULLIF(tax_rate_rental,0), tax_pct);
