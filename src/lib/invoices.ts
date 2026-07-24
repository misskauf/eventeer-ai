// Invoice document renderer — extends the contract placeholder system with
// line-items table and totals derived from the accepted proposal.
import { money } from "@/lib/pricing";
import { buildPlaceholderValues, ensureHtml, type ContractContext } from "@/lib/contracts";

export type InvoiceLineItem = {
  label: string;
  qty?: number | string;
  unit_price?: number;
  line_total?: number;
};

export type InvoiceContext = ContractContext & {
  line_items?: InvoiceLineItem[];
  service_charge?: number;
  invoice_notes?: string | null;
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lineItemsTable(items: InvoiceLineItem[] | undefined, currency: string): string {
  if (!items || items.length === 0) return "—";
  const rows = items
    .map(
      (i) => `<tr>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(i.label)}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${i.qty != null ? esc(String(i.qty)) : ""}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${i.unit_price != null ? money(i.unit_price, currency) : ""}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${i.line_total != null ? money(i.line_total, currency) : ""}</td>
</tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0">
  <thead><tr>
    <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #111">Item</th>
    <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111">Qty</th>
    <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111">Unit</th>
    <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111">Amount</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

export function renderInvoice(body: string, ctx: InvoiceContext): string {
  const currency = ctx.company?.currency ?? "USD";
  const base = buildPlaceholderValues(ctx);
  const extra: Record<string, string> = {
    line_items_table: lineItemsTable(ctx.line_items, currency),
    service_charge: ctx.service_charge != null ? money(ctx.service_charge, currency) : "—",
    invoice_notes: ctx.invoice_notes
      ? `<p style="margin:8px 0;color:#374151">${esc(ctx.invoice_notes)}</p>`
      : "",
  };
  const values = { ...base, ...extra };
  return ensureHtml(body).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key: string) => {
    const v = values[key.toLowerCase()];
    return v == null ? m : v;
  });
}

// A reasonable empty starter for brand-new templates.
export const DEFAULT_INVOICE_TEMPLATE = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:16px">
  <div>
    <h1 style="margin:0">Invoice</h1>
    <p style="margin:4px 0 0;font-size:12px;color:#555">Date: {{today}}</p>
  </div>
  <div style="text-align:right">{{company_logo}}<p style="margin:6px 0 0;font-size:12px;color:#555">{{company_name}}<br/>{{company_address}}<br/>{{company_email}}</p></div>
</div>
<h3>Bill to</h3>
<p>{{client_name}}<br/>{{client_company}}<br/>{{client_email}}</p>
<h3>Event</h3>
<p>{{event_date}} · {{guest_count}} guests · {{venue}}</p>
{{line_items_table}}
<table style="width:100%;margin-top:8px"><tbody>
  <tr><td style="text-align:right;padding:2px 8px">Subtotal</td><td style="text-align:right;padding:2px 0;width:120px">{{subtotal}}</td></tr>
  <tr><td style="text-align:right;padding:2px 8px">Service charge</td><td style="text-align:right;padding:2px 0">{{service_charge}}</td></tr>
  <tr><td style="text-align:right;padding:2px 8px">Tax</td><td style="text-align:right;padding:2px 0">{{tax}}</td></tr>
  <tr><td style="text-align:right;padding:6px 8px;border-top:2px solid #111;font-weight:600">Total</td><td style="text-align:right;padding:6px 0;border-top:2px solid #111;font-weight:600">{{total}}</td></tr>
</tbody></table>
{{invoice_notes}}`;
