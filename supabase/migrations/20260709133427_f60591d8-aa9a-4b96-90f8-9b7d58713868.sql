
REVOKE ALL ON FUNCTION public.user_company_id(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_member_of(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_company_id(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_member_of(UUID, UUID) TO service_role;
