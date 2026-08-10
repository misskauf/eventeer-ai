ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS client_select_space text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS client_select_food text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS client_select_beverage text NOT NULL DEFAULT 'single';

ALTER TABLE public.companies
  ADD CONSTRAINT companies_client_select_space_chk CHECK (client_select_space IN ('single','multi')),
  ADD CONSTRAINT companies_client_select_food_chk CHECK (client_select_food IN ('single','multi')),
  ADD CONSTRAINT companies_client_select_beverage_chk CHECK (client_select_beverage IN ('single','multi'));