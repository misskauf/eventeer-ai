-- 1. Migrate existing role rows to the new canonical roles
UPDATE public.user_roles SET role = 'sales_manager' WHERE role = 'sales';
UPDATE public.user_roles SET role = 'event_manager' WHERE role = 'manager';
UPDATE public.companies
SET cost_visible_roles = (
  SELECT array_agg(CASE r WHEN 'sales' THEN 'sales_manager' WHEN 'manager' THEN 'event_manager' ELSE r END)
  FROM unnest(cost_visible_roles) AS r
)
WHERE cost_visible_roles && ARRAY['sales','manager'];

-- 2. user_roles status flags
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_status_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_status_check
  CHECK (status IN ('active','invited','disabled'));

-- 3. role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  module text NOT NULL,
  level text NOT NULL DEFAULT 'none',
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_permissions_level_check CHECK (level IN ('none','view','edit','admin')),
  CONSTRAINT role_permissions_scope_check CHECK (scope IS NULL OR scope IN ('own','all')),
  CONSTRAINT role_permissions_module_check CHECK (module IN (
    'deals','proposals','contracts','invoices','catalog','staff','costs',
    'analytics','event_briefs','lead_forms','settings','team')),
  CONSTRAINT role_permissions_unique UNIQUE (company_id, role, module)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read role permissions" ON public.role_permissions;
CREATE POLICY "Members read role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), company_id));

DROP POLICY IF EXISTS "Owners manage role permissions" ON public.role_permissions;
CREATE POLICY "Owners manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.company_id = role_permissions.company_id AND ur.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.company_id = role_permissions.company_id AND ur.role = 'owner'));

DROP TRIGGER IF EXISTS role_permissions_set_updated_at ON public.role_permissions;
CREATE TRIGGER role_permissions_set_updated_at BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. company_invites
CREATE TABLE IF NOT EXISTS public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invites TO authenticated;
GRANT ALL ON public.company_invites TO service_role;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage invites" ON public.company_invites;
CREATE POLICY "Owners manage invites" ON public.company_invites
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.company_id = company_invites.company_id AND ur.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.company_id = company_invites.company_id AND ur.role = 'owner'));

-- 5. permission_audit
CREATE TABLE IF NOT EXISTS public.permission_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.permission_audit TO authenticated;
GRANT ALL ON public.permission_audit TO service_role;
ALTER TABLE public.permission_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read permission audit" ON public.permission_audit;
CREATE POLICY "Owners read permission audit" ON public.permission_audit
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.company_id = permission_audit.company_id AND ur.role = 'owner'));

-- 6. Default preset seeder
CREATE OR REPLACE FUNCTION public.seed_role_permissions(_company_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.role_permissions (company_id, role, module, level, scope)
  SELECT _company_id, d.role::public.app_role, d.module, d.level, d.scope
  FROM (VALUES
    ('owner','deals','admin','all'),('owner','proposals','admin',NULL),('owner','contracts','admin',NULL),
    ('owner','invoices','admin',NULL),('owner','catalog','admin',NULL),('owner','staff','admin',NULL),
    ('owner','costs','admin',NULL),('owner','analytics','admin',NULL),('owner','event_briefs','admin',NULL),
    ('owner','lead_forms','admin',NULL),('owner','settings','admin',NULL),('owner','team','admin',NULL),

    ('sales_manager','deals','edit','all'),('sales_manager','proposals','edit',NULL),('sales_manager','contracts','edit',NULL),
    ('sales_manager','invoices','view',NULL),('sales_manager','catalog','view',NULL),('sales_manager','staff','none',NULL),
    ('sales_manager','costs','none',NULL),('sales_manager','analytics','view',NULL),('sales_manager','event_briefs','edit',NULL),
    ('sales_manager','lead_forms','edit',NULL),('sales_manager','settings','none',NULL),('sales_manager','team','none',NULL),

    ('event_manager','deals','view','all'),('event_manager','proposals','view',NULL),('event_manager','contracts','view',NULL),
    ('event_manager','invoices','none',NULL),('event_manager','catalog','view',NULL),('event_manager','staff','edit',NULL),
    ('event_manager','costs','none',NULL),('event_manager','analytics','view',NULL),('event_manager','event_briefs','edit',NULL),
    ('event_manager','lead_forms','none',NULL),('event_manager','settings','none',NULL),('event_manager','team','none',NULL),

    ('accounting','deals','view','all'),('accounting','proposals','none',NULL),('accounting','contracts','none',NULL),
    ('accounting','invoices','edit',NULL),('accounting','catalog','none',NULL),('accounting','staff','none',NULL),
    ('accounting','costs','view',NULL),('accounting','analytics','view',NULL),('accounting','event_briefs','none',NULL),
    ('accounting','lead_forms','none',NULL),('accounting','settings','none',NULL),('accounting','team','none',NULL)
  ) AS d(role, module, level, scope)
  ON CONFLICT (company_id, role, module) DO NOTHING;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_role_permissions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_role_permissions(uuid) TO service_role;

-- backfill existing companies
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_role_permissions(c.id);
  END LOOP;
END $$;

-- 7. Permission helpers
CREATE OR REPLACE FUNCTION public.permission_level(_company_id uuid, _module text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.company_id = _company_id
        AND ur.role = 'owner' AND ur.active
    ) THEN 'admin'
    ELSE COALESCE((
      SELECT rp.level
      FROM public.user_roles ur
      JOIN public.role_permissions rp
        ON rp.company_id = ur.company_id AND rp.role = ur.role
      WHERE ur.user_id = auth.uid() AND ur.company_id = _company_id
        AND ur.active AND rp.module = _module
      LIMIT 1
    ), 'none')
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_company_id uuid, _module text, _min_level text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE public.permission_level(_company_id, _module)
           WHEN 'admin' THEN 3 WHEN 'edit' THEN 2 WHEN 'view' THEN 1 ELSE 0 END
       >= CASE _min_level
           WHEN 'admin' THEN 3 WHEN 'edit' THEN 2 WHEN 'view' THEN 1 ELSE 0 END;
$$;

REVOKE EXECUTE ON FUNCTION public.permission_level(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permission_level(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, service_role;

-- 8. Seed presets for newly created companies
CREATE OR REPLACE FUNCTION public.create_company_workspace(_name text, _primary_color text, _currency text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.companies (name, primary_color, currency, created_by)
  VALUES (_name, COALESCE(NULLIF(_primary_color, ''), '#0f172a'), COALESCE(NULLIF(_currency, ''), 'USD'), _uid)
  RETURNING id INTO _company_id;

  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (_uid, _company_id, 'owner');

  INSERT INTO public.fee_config (company_id) VALUES (_company_id);

  PERFORM public.seed_role_permissions(_company_id);

  RETURN _company_id;
END;
$$;