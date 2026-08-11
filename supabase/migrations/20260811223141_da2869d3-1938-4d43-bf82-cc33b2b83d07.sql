ALTER TYPE public.share_token_kind ADD VALUE IF NOT EXISTS 'payments';

ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_module_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_module_check
  CHECK (module = ANY (ARRAY['deals','proposals','contracts','invoices','catalog','staff','costs','analytics','event_briefs','lead_forms','settings','team','payments']));

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_iban text,
  ADD COLUMN IF NOT EXISTS bank_bic text,
  ADD COLUMN IF NOT EXISTS payment_reference_note text;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  method text,
  paid_at timestamptz,
  marked_by uuid REFERENCES auth.users(id),
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), company_id) AND public.has_permission(company_id, 'payments', 'view'));

CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(auth.uid(), company_id) AND public.has_permission(company_id, 'payments', 'edit'));

CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated
  USING (public.is_member_of(auth.uid(), company_id) AND public.has_permission(company_id, 'payments', 'edit'))
  WITH CHECK (public.is_member_of(auth.uid(), company_id) AND public.has_permission(company_id, 'payments', 'edit'));

CREATE POLICY "payments_delete" ON public.payments FOR DELETE TO authenticated
  USING (public.is_member_of(auth.uid(), company_id) AND public.has_permission(company_id, 'payments', 'edit'));

CREATE INDEX payments_deal_idx ON public.payments (deal_id, sort);

CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- backfill role_permissions for the new module
INSERT INTO public.role_permissions (company_id, role, module, level, scope)
SELECT c.id, v.role::public.app_role, 'payments', v.level, NULL
FROM public.companies c
CROSS JOIN (VALUES
  ('owner','admin'),
  ('sales_manager','view'),
  ('event_manager','none'),
  ('accounting','edit')
) AS v(role, level)
ON CONFLICT (company_id, role, module) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_role_permissions(_company_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO public.role_permissions (company_id, role, module, level, scope)
  SELECT _company_id, d.role::public.app_role, d.module, d.level, d.scope
  FROM (VALUES
    ('owner','deals','admin','all'),('owner','proposals','admin',NULL),('owner','contracts','admin',NULL),
    ('owner','invoices','admin',NULL),('owner','catalog','admin',NULL),('owner','staff','admin',NULL),
    ('owner','costs','admin',NULL),('owner','analytics','admin',NULL),('owner','event_briefs','admin',NULL),
    ('owner','lead_forms','admin',NULL),('owner','settings','admin',NULL),('owner','team','admin',NULL),
    ('owner','payments','admin',NULL),

    ('sales_manager','deals','edit','all'),('sales_manager','proposals','edit',NULL),('sales_manager','contracts','edit',NULL),
    ('sales_manager','invoices','view',NULL),('sales_manager','catalog','view',NULL),('sales_manager','staff','none',NULL),
    ('sales_manager','costs','none',NULL),('sales_manager','analytics','view',NULL),('sales_manager','event_briefs','edit',NULL),
    ('sales_manager','lead_forms','edit',NULL),('sales_manager','settings','none',NULL),('sales_manager','team','none',NULL),
    ('sales_manager','payments','view',NULL),

    ('event_manager','deals','view','all'),('event_manager','proposals','view',NULL),('event_manager','contracts','view',NULL),
    ('event_manager','invoices','none',NULL),('event_manager','catalog','view',NULL),('event_manager','staff','edit',NULL),
    ('event_manager','costs','none',NULL),('event_manager','analytics','view',NULL),('event_manager','event_briefs','edit',NULL),
    ('event_manager','lead_forms','none',NULL),('event_manager','settings','none',NULL),('event_manager','team','none',NULL),
    ('event_manager','payments','none',NULL),

    ('accounting','deals','view','all'),('accounting','proposals','none',NULL),('accounting','contracts','none',NULL),
    ('accounting','invoices','edit',NULL),('accounting','catalog','none',NULL),('accounting','staff','none',NULL),
    ('accounting','costs','view',NULL),('accounting','analytics','view',NULL),('accounting','event_briefs','none',NULL),
    ('accounting','lead_forms','none',NULL),('accounting','settings','none',NULL),('accounting','team','none',NULL),
    ('accounting','payments','edit',NULL)
  ) AS d(role, module, level, scope)
  ON CONFLICT (company_id, role, module) DO NOTHING;
$function$;
