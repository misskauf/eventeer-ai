ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS capacity_standing integer,
  ADD COLUMN IF NOT EXISTS capacity_seated integer,
  ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}';