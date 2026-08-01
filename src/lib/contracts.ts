// Substitute {{placeholders}} in a contract template body with deal and
// company details. Template bodies are HTML; list-style values render as
// <ul>/<img> fragments so they slot into the rich-text layout cleanly.

import { money } from "@/lib/pricing";
import { formatEventDate } from "@/lib/date-format";

export type ContractContext = {
  deal: any;
  company: any;
  spaces?: Array<{ name: string }>;
  foodPackages?: Array<{ name: string }>;
  beveragePackages?: Array<{ name: string; included_hours?: number | null }>;
  extras?: Array<{ name: string; qty?: number }>;
  staff?: Array<{ name: string; qty?: number; hours?: number }>;
  totals?: { subtotal?: number; tax?: number; total?: number };
  event_hours?: number | null;
  menu_selections?: string[]; // human-readable lines
  quote_number?: string | null; // accepted proposal's quote reference
};

export const CONTRACT_PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: "client_name", label: "Client name" },
  { key: "quote_number", label: "Quote number" },
  { key: "client_company", label: "Client company" },
  { key: "client_email", label: "Client email" },
  { key: "event_date", label: "Event date" },
  { key: "guest_count", label: "Guest count" },
  { key: "event_hours", label: "Event hours" },
  { key: "venue", label: "Selected venue(s)" },
  { key: "food_package", label: "Food package" },
  { key: "drinks_package", label: "Drinks package" },
  { key: "menu_selections", label: "Menu selections" },
  { key: "extras", label: "Extras (list)" },
  { key: "staff", label: "Staffing (list)" },
  { key: "line_items_table", label: "Line items table" },
  { key: "subtotal", label: "Subtotal" },
  { key: "service_charge", label: "Service charge" },
  { key: "tax", label: "Tax" },
  { key: "total", label: "Total" },
  { key: "currency", label: "Currency" },
  { key: "today", label: "Today's date" },
  { key: "invoice_notes", label: "Invoice notes" },
  { key: "company_name", label: "Company name" },
  { key: "company_logo", label: "Company logo" },
  { key: "company_address", label: "Company address" },
  { key: "company_email", label: "Company email" },
  { key: "company_phone", label: "Company phone" },
  { key: "company_website", label: "Company website" },
  { key: "client_signature", label: "Client signature (image)" },
  { key: "client_signature_name", label: "Client signature name" },
  { key: "client_signature_date", label: "Client signature date" },
  { key: "client_signature_place", label: "Client signature place" },
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function joinNames(items?: Array<{ name: string }>): string {
  if (!items || items.length === 0) return "—";
  return items.map((i) => i.name).join(", ");
}

function htmlList(items: string[]): string {
  if (items.length === 0) return "—";
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function extrasHtml(items?: Array<{ name: string; qty?: number }>): string {
  if (!items || items.length === 0) return "—";
  return htmlList(
    items.map((i) => (i.qty && i.qty > 1 ? `${i.name} × ${i.qty}` : i.name)),
  );
}

function staffHtml(items?: Array<{ name: string; qty?: number; hours?: number }>): string {
  if (!items || items.length === 0) return "—";
  return htmlList(
    items.map((i) => {
      const parts: string[] = [i.name];
      if (i.qty && i.qty > 1) parts.push(`× ${i.qty}`);
      if (i.hours) parts.push(`(${i.hours}h)`);
      return parts.join(" ");
    }),
  );
}

function companyLogoHtml(company: any): string {
  const url = company?.logo_url;
  if (!url) return "";
  const alt = esc(company?.name ?? "");
  return `<img src="${esc(url)}" alt="${alt}" style="max-height:64px" />`;
}

export function buildPlaceholderValues(ctx: ContractContext): Record<string, string> {
  const currency = ctx.company?.currency ?? "USD";
  const t = ctx.totals ?? {};
  return {
    client_name: ctx.deal?.client_name ?? "",
    quote_number: ctx.quote_number ?? "—",
    client_company: ctx.deal?.client_company ?? "",
    client_email: ctx.deal?.client_email ?? "",
    event_date: ctx.deal?.event_date ? formatEventDate(ctx.deal.event_date) : "—",
    guest_count: String(ctx.deal?.guest_count ?? "—"),
    event_hours: ctx.event_hours != null ? String(ctx.event_hours) : "—",
    venue: joinNames(ctx.spaces),
    food_package: joinNames(ctx.foodPackages),
    drinks_package: joinNames(ctx.beveragePackages),
    menu_selections:
      ctx.menu_selections && ctx.menu_selections.length ? htmlList(ctx.menu_selections) : "—",
    extras: extrasHtml(ctx.extras),
    staff: staffHtml(ctx.staff),
    subtotal: t.subtotal != null ? money(t.subtotal, currency) : "—",
    tax: t.tax != null ? money(t.tax, currency) : "—",
    total: t.total != null ? money(t.total, currency) : "—",
    currency,
    today: new Date().toLocaleDateString(),
    company_name: ctx.company?.name ?? "",
    company_logo: companyLogoHtml(ctx.company),
    company_address: ctx.company?.address ?? "",
    company_email: ctx.company?.contact_email ?? "",
    company_phone: ctx.company?.contact_phone ?? "",
    company_website: ctx.company?.website ?? "",
  };
}

export function renderContract(body: string, ctx: ContractContext): string {
  const values = buildPlaceholderValues(ctx);
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key: string) => {
    const v = values[key.toLowerCase()];
    return v == null ? m : v;
  });
}

// Old templates stored as plain text — wrap so they render in the HTML editor.
export function ensureHtml(body: string | null | undefined): string {
  const b = (body ?? "").trim();
  if (!b) return "";
  if (b.startsWith("<")) return b;
  return `<pre>${esc(b)}</pre>`;
}
