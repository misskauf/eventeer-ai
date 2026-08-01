CREATE TABLE public.deal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  item_type text NOT NULL CHECK (item_type IN ('space','package','extra','staff')),
  item_id uuid,
  item_name text NOT NULL,
  space_id uuid,
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  line_gross numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  line_cost numeric NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_items TO authenticated;
GRANT ALL ON public.deal_items TO service_role;

ALTER TABLE public.deal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their company deal items"
ON public.deal_items FOR ALL TO authenticated
USING (public.is_member_of(auth.uid(), company_id))
WITH CHECK (public.is_member_of(auth.uid(), company_id));

CREATE INDEX deal_items_company_deal_idx ON public.deal_items (company_id, deal_id);
CREATE INDEX deal_items_company_item_idx ON public.deal_items (company_id, item_type, item_id);
CREATE UNIQUE INDEX deal_items_unique_line ON public.deal_items (deal_id, item_type, COALESCE(item_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE OR REPLACE FUNCTION public.can_view_costs(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.companies c ON c.id = ur.company_id
    WHERE ur.user_id = _user_id
      AND (ur.role = 'owner' OR ur.role::text = ANY (c.cost_visible_roles))
  );
$$;

CREATE VIEW public.deal_items_visible
WITH (security_invoker = true)
AS
SELECT
  di.id,
  di.company_id,
  di.deal_id,
  di.proposal_id,
  di.item_type,
  di.item_id,
  di.item_name,
  di.space_id,
  di.qty,
  di.unit_price,
  di.line_total,
  di.line_gross,
  CASE WHEN public.can_view_costs(auth.uid()) THEN di.unit_cost ELSE NULL END AS unit_cost,
  CASE WHEN public.can_view_costs(auth.uid()) THEN di.line_cost ELSE NULL END AS line_cost,
  di.captured_at,
  di.created_at
FROM public.deal_items di;

GRANT SELECT ON public.deal_items_visible TO authenticated;
GRANT SELECT ON public.deal_items_visible TO service_role;