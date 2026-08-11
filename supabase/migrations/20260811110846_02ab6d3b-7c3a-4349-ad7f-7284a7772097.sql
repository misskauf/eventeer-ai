ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS venue_type text,
  ADD COLUMN IF NOT EXISTS current_software text;