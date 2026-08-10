ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS seating_capacities jsonb NOT NULL DEFAULT '{}'::jsonb;