REVOKE ALL ON FUNCTION public.can_view_costs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_costs(uuid) TO authenticated, service_role;