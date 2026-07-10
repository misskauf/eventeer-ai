ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS days_of_week smallint[] NOT NULL DEFAULT '{}';
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS months smallint[] NOT NULL DEFAULT '{}';

UPDATE public.pricing_rules SET days_of_week = ARRAY[day_of_week]::smallint[] WHERE day_of_week IS NOT NULL AND (days_of_week IS NULL OR array_length(days_of_week,1) IS NULL);
UPDATE public.pricing_rules SET months = ARRAY[month]::smallint[] WHERE month IS NOT NULL AND (months IS NULL OR array_length(months,1) IS NULL);