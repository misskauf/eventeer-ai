-- 1. Scope helper -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_scope(_company_id uuid, _module text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.company_id = _company_id
        AND ur.role = 'owner' AND ur.active
    ) THEN 'all'
    ELSE COALESCE((
      SELECT rp.scope
      FROM public.user_roles ur
      JOIN public.role_permissions rp
        ON rp.company_id = ur.company_id AND rp.role = ur.role
      WHERE ur.user_id = auth.uid() AND ur.company_id = _company_id
        AND ur.active AND rp.module = _module
      LIMIT 1
    ), 'all')
  END;
$$;

-- 2. Costs now come from the permission matrix -------------------------------
CREATE OR REPLACE FUNCTION public.can_view_costs(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.role_permissions rp
      ON rp.company_id = ur.company_id AND rp.role = ur.role AND rp.module = 'costs'
    WHERE ur.user_id = _user_id
      AND ur.active
      AND (ur.role = 'owner' OR rp.level IN ('view', 'edit', 'admin'))
  );
$$;

ALTER TABLE public.companies DROP COLUMN IF EXISTS cost_visible_roles;

-- 3. Deals -------------------------------------------------------------------
DROP POLICY IF EXISTS "members manage deals" ON public.deals;

CREATE POLICY "deals select by permission" ON public.deals
FOR SELECT TO authenticated
USING (
  public.has_permission(company_id, 'deals', 'view')
  AND (public.record_scope(company_id, 'deals') = 'all' OR owner_id = auth.uid())
);

CREATE POLICY "deals insert by permission" ON public.deals
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(company_id, 'deals', 'edit'));

CREATE POLICY "deals update by permission" ON public.deals
FOR UPDATE TO authenticated
USING (
  public.has_permission(company_id, 'deals', 'edit')
  AND (public.record_scope(company_id, 'deals') = 'all' OR owner_id = auth.uid())
)
WITH CHECK (public.has_permission(company_id, 'deals', 'edit'));

CREATE POLICY "deals delete by permission" ON public.deals
FOR DELETE TO authenticated
USING (
  public.has_permission(company_id, 'deals', 'edit')
  AND (public.record_scope(company_id, 'deals') = 'all' OR owner_id = auth.uid())
);

-- 4. Proposals ---------------------------------------------------------------
DROP POLICY IF EXISTS "members manage proposals" ON public.proposals;

CREATE POLICY "proposals select by permission" ON public.proposals
FOR SELECT TO authenticated
USING (
  public.has_permission(company_id, 'proposals', 'view')
  AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = proposals.deal_id
      AND (public.record_scope(proposals.company_id, 'proposals') = 'all' OR d.owner_id = auth.uid())
  )
);

CREATE POLICY "proposals write by permission" ON public.proposals
FOR ALL TO authenticated
USING (
  public.has_permission(company_id, 'proposals', 'edit')
  AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = proposals.deal_id
      AND (public.record_scope(proposals.company_id, 'proposals') = 'all' OR d.owner_id = auth.uid())
  )
)
WITH CHECK (public.has_permission(company_id, 'proposals', 'edit'));

-- 5. Contracts ---------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Members can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Members can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Members can delete contracts" ON public.contracts;

CREATE POLICY "contracts select by permission" ON public.contracts
FOR SELECT TO authenticated
USING (
  public.has_permission(company_id, 'contracts', 'view')
  AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = contracts.deal_id
      AND (public.record_scope(contracts.company_id, 'contracts') = 'all' OR d.owner_id = auth.uid())
  )
);

CREATE POLICY "contracts write by permission" ON public.contracts
FOR ALL TO authenticated
USING (
  public.has_permission(company_id, 'contracts', 'edit')
  AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = contracts.deal_id
      AND (public.record_scope(contracts.company_id, 'contracts') = 'all' OR d.owner_id = auth.uid())
  )
)
WITH CHECK (public.has_permission(company_id, 'contracts', 'edit'));

-- 6. Event briefs ------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view their company briefs" ON public.event_briefs;
DROP POLICY IF EXISTS "Members can create their company briefs" ON public.event_briefs;
DROP POLICY IF EXISTS "Members can update their company briefs" ON public.event_briefs;
DROP POLICY IF EXISTS "Members can delete their company briefs" ON public.event_briefs;

CREATE POLICY "briefs select by permission" ON public.event_briefs
FOR SELECT TO authenticated
USING (
  public.has_permission(company_id, 'event_briefs', 'view')
  AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = event_briefs.deal_id
      AND (public.record_scope(event_briefs.company_id, 'event_briefs') = 'all' OR d.owner_id = auth.uid())
  )
);

CREATE POLICY "briefs write by permission" ON public.event_briefs
FOR ALL TO authenticated
USING (
  public.has_permission(company_id, 'event_briefs', 'edit')
  AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = event_briefs.deal_id
      AND (public.record_scope(event_briefs.company_id, 'event_briefs') = 'all' OR d.owner_id = auth.uid())
  )
)
WITH CHECK (public.has_permission(company_id, 'event_briefs', 'edit'));

-- 7. Invoices ----------------------------------------------------------------
DROP POLICY IF EXISTS "Members manage invoices" ON public.invoices;

CREATE POLICY "invoices select by permission" ON public.invoices
FOR SELECT TO authenticated
USING (public.has_permission(company_id, 'invoices', 'view'));

CREATE POLICY "invoices write by permission" ON public.invoices
FOR ALL TO authenticated
USING (public.has_permission(company_id, 'invoices', 'edit'))
WITH CHECK (public.has_permission(company_id, 'invoices', 'edit'));

-- 8. Deal item snapshots (carry internal costs) -------------------------------
DROP POLICY IF EXISTS "Members manage their company deal items" ON public.deal_items;

CREATE POLICY "deal items select by permission" ON public.deal_items
FOR SELECT TO authenticated
USING (public.has_permission(company_id, 'analytics', 'view'));

CREATE POLICY "deal items write by permission" ON public.deal_items
FOR ALL TO authenticated
USING (public.has_permission(company_id, 'deals', 'edit'))
WITH CHECK (public.has_permission(company_id, 'deals', 'edit'));

-- 9. Company settings --------------------------------------------------------
DROP POLICY IF EXISTS "members update company" ON public.companies;

CREATE POLICY "company update by permission" ON public.companies
FOR UPDATE TO authenticated
USING (public.has_permission(id, 'settings', 'edit'))
WITH CHECK (public.has_permission(id, 'settings', 'edit'));

-- 10. Permission administration ----------------------------------------------
DROP POLICY IF EXISTS "Owners manage role permissions" ON public.role_permissions;

CREATE POLICY "role permissions managed by team admins" ON public.role_permissions
FOR ALL TO authenticated
USING (public.has_permission(company_id, 'team', 'admin'))
WITH CHECK (public.has_permission(company_id, 'team', 'admin'));

DROP POLICY IF EXISTS "Owners manage invites" ON public.company_invites;

CREATE POLICY "invites managed by team admins" ON public.company_invites
FOR ALL TO authenticated
USING (public.has_permission(company_id, 'team', 'admin'))
WITH CHECK (public.has_permission(company_id, 'team', 'admin'));

DROP POLICY IF EXISTS "Owners read permission audit" ON public.permission_audit;

CREATE POLICY "audit readable by team viewers" ON public.permission_audit
FOR SELECT TO authenticated
USING (public.has_permission(company_id, 'team', 'view'));