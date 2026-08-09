UPDATE public.platform_admins pa
SET user_id = u.id
FROM auth.users u
WHERE pa.user_id IS NULL AND lower(u.email) = lower(pa.email);

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
  )
$$;