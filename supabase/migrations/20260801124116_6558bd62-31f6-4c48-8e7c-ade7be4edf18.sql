ALTER TABLE public.fb_packages ADD COLUMN IF NOT EXISTS event_types text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS event_types text[] NOT NULL DEFAULT '{}';