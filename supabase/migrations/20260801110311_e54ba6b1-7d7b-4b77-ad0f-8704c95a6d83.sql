ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accounting';

ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;
ALTER TABLE public.fb_packages ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;
ALTER TABLE public.extras ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;
ALTER TABLE public.staff_roles ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cost_visible_roles text[] NOT NULL DEFAULT '{}';