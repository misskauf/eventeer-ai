
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'new';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'contacted';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'meeting_scheduled';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'signed';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'waiting_payment';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'invoice_sent';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'downpayment_received';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'paid_in_full';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'payment_delayed';
