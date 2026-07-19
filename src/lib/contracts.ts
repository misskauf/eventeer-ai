// Substitute {{placeholders}} in a contract template body with deal details.
// Values are stringified plainly; unknown placeholders are left as-is so the
// manager can spot and fix typos.

import { money } from "@/hooks/use-company-currency";
import { formatEventDate } from "@/lib/date-format";

export type ContractContext = {
  deal: any;
  company: any;
  spaces?: Array<{ name: string }>;
  foodPackages?: Array<{ name: string }>;
  beveragePackages?: Array<{ name: string; included_hours?: number | null }>;
  extras?: Array<{ name: string; qty?: number }>;
  totals?: { subtotal?: number; tax?: number; total?: number };
  event_hours?: number | null;
  menu_selections?: string[]; // human-readable lines
};

export const CONTRACT_PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: "client_name", label: "Client name" },
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
  { key: "subtotal", label: "Subtotal" },
  { key: "tax", label: "Tax" },
  { key: "total", label: "Total" },
  { key: "currency", label: "Currency" },
  { key: "company_name", label: "Company name" },
  { key: "today", label: "Today's date" },
];

function joinNames(items?: Array<{ name: string }>): string {
  if (!items || items.length === 0) return "—";
  return items.map((i) => i.name).join(", ");
}

function extrasList(items?: Array<{ name: string; qty?: number }>): string {
  if (!items || items.length === 0) return "—";
  return items
    .map((i) => (i.qty && i.qty > 1 ? `- ${i.name} × ${i.qty}` : `- ${i.name}`))
    .join("\n");
}

export function buildPlaceholderValues(ctx: ContractContext): Record<string, string> {
  const currency = ctx.company?.currency ?? "USD";
  const t = ctx.totals ?? {};
  return {
    client_name: ctx.deal?.client_name ?? "",
    client_company: ctx.deal?.client_company ?? "",
    client_email: ctx.deal?.client_email ?? "",
    event_date: ctx.deal?.event_date ? formatEventDate(ctx.deal.event_date) : "—",
    guest_count: String(ctx.deal?.guest_count ?? "—"),
    event_hours: ctx.event_hours != null ? String(ctx.event_hours) : "—",
    venue: joinNames(ctx.spaces),
    food_package: joinNames(ctx.foodPackages),
    drinks_package: joinNames(ctx.beveragePackages),
    menu_selections: ctx.menu_selections && ctx.menu_selections.length
      ? ctx.menu_selections.map((l) => `- ${l}`).join("\n")
      : "—",
    extras: extrasList(ctx.extras),
    subtotal: t.subtotal != null ? money(t.subtotal, currency) : "—",
    tax: t.tax != null ? money(t.tax, currency) : "—",
    total: t.total != null ? money(t.total, currency) : "—",
    currency,
    company_name: ctx.company?.name ?? "",
    today: new Date().toLocaleDateString(),
  };
}

export function renderContract(body: string, ctx: ContractContext): string {
  const values = buildPlaceholderValues(ctx);
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key: string) => {
    const v = values[key.toLowerCase()];
    return v == null ? m : v;
  });
}
