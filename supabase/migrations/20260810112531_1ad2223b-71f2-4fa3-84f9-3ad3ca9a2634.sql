CREATE OR REPLACE FUNCTION public.is_member_of(_user_id uuid, _company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND active
      AND status = 'active'
  );
$function$;

DROP POLICY IF EXISTS "Members manage invoice templates" ON public.invoice_templates;
CREATE POLICY "Members manage invoice templates" ON public.invoice_templates
  FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), company_id))
  WITH CHECK (public.is_member_of(auth.uid(), company_id));

-- Signed-out visitors must not be able to execute internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.permission_level(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_scope(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_costs(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_quote_number(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_company_workspace(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_company_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_role_permissions(uuid) FROM anon;

-- Internal-only helpers: not callable by signed-in users either
REVOKE EXECUTE ON FUNCTION public.seed_role_permissions(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.user_company_id(uuid) FROM authenticated;