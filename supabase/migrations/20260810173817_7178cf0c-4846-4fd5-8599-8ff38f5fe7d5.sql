ALTER POLICY "contracts write by permission" ON public.contracts
WITH CHECK (has_permission(company_id, 'contracts', 'edit') AND (EXISTS (
  SELECT 1 FROM deals d WHERE d.id = contracts.deal_id
    AND (record_scope(contracts.company_id, 'contracts') = 'all' OR d.owner_id = auth.uid()))));

ALTER POLICY "briefs write by permission" ON public.event_briefs
WITH CHECK (has_permission(company_id, 'event_briefs', 'edit') AND (EXISTS (
  SELECT 1 FROM deals d WHERE d.id = event_briefs.deal_id
    AND (record_scope(event_briefs.company_id, 'event_briefs') = 'all' OR d.owner_id = auth.uid()))));

ALTER POLICY "proposals write by permission" ON public.proposals
WITH CHECK (has_permission(company_id, 'proposals', 'edit') AND (EXISTS (
  SELECT 1 FROM deals d WHERE d.id = proposals.deal_id
    AND (record_scope(proposals.company_id, 'proposals') = 'all' OR d.owner_id = auth.uid()))));