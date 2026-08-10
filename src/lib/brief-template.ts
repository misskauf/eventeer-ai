// Placeholder layer for custom BEO / event brief templates.
// Reuses the contract placeholder values so tokens resolve identically, and
// adds brief-only tokens (seating style, allergens, totals summary).

import { buildPlaceholderValues, type ContractContext } from "@/lib/contracts";
import type { BriefExtras } from "@/lib/event-brief";
import { money } from "@/lib/pricing";

export const BRIEF_PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: "client_name", label: "Client name" },
  { key: "client_company", label: "Client company" },
  { key: "client_email", label: "Client email" },
  { key: "client_phone", label: "Client phone" },
  { key: "event_type", label: "Event type" },
  { key: "event_date", label: "Event date" },
  { key: "event_hours", label: "Event hours" },
  { key: "guest_count", label: "Guest count" },
  { key: "space", label: "Space(s)" },
  { key: "seating_style", label: "Seating arrangement" },
  { key: "food", label: "Food package(s)" },
  { key: "beverages", label: "Beverage package(s)" },
  { key: "menu_selections", label: "Menu selections" },
  { key: "extras", label: "Extras (list)" },
  { key: "staff", label: "Staffing (list)" },
  { key: "allergens", label: "Allergen notes" },
  { key: "totals", label: "Totals summary" },
  { key: "subtotal", label: "Subtotal" },
  { key: "tax", label: "Tax" },
  { key: "total", label: "Total" },
  { key: "quote_number", label: "Quote number" },
  { key: "owner", label: "Deal owner" },
  { key: "status", label: "Deal status" },
  { key: "today", label: "Today's date" },
  { key: "company_name", label: "Company name" },
  { key: "company_logo", label: "Company logo" },
  { key: "company_address", label: "Company address" },
  { key: "company_email", label: "Company email" },
  { key: "company_phone", label: "Company phone" },
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildBriefPlaceholderValues(
  ctx: ContractContext,
  extra: BriefExtras & { seatingStyle?: string | null } = {},
): Record<string, string> {
  const base = buildPlaceholderValues(ctx);
  const currency = ctx.company?.currency ?? "USD";
  const t = ctx.totals ?? {};
  const deal: any = ctx.deal ?? {};

  const allergens =
    extra.allergenNotes && extra.allergenNotes.length
      ? `<ul>${extra.allergenNotes.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`
      : "—";

  const totalsRows = [
    t.subtotal != null ? `<li>Subtotal: ${money(t.subtotal, currency)}</li>` : "",
    t.tax != null ? `<li>Tax: ${money(t.tax, currency)}</li>` : "",
    t.total != null ? `<li>Total: ${money(t.total, currency)}</li>` : "",
  ].join("");

  const seating =
    extra.seatingStyle ?? deal.seating_style ?? deal.custom_fields?.seating_style ?? null;

  return {
    ...base,
    // brief-friendly aliases
    space: base.venue,
    food: base.food_package,
    beverages: base.drinks_package,
    seating_style: seating ? esc(String(seating)) : "—",
    allergens,
    totals: totalsRows ? `<ul>${totalsRows}</ul>` : "—",
    event_type: deal.event_type ? esc(String(deal.event_type)) : "—",
    client_phone: extra.clientPhone ? esc(extra.clientPhone) : "—",
    owner: extra.ownerLabel ? esc(extra.ownerLabel) : "—",
    status: esc(String(extra.statusLabel ?? deal.stage ?? "—")),
  };
}

export function renderBrief(
  body: string,
  ctx: ContractContext,
  extra: BriefExtras & { seatingStyle?: string | null } = {},
): string {
  const values = buildBriefPlaceholderValues(ctx, extra);
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key: string) => {
    const v = values[key.toLowerCase()];
    return v == null ? m : v;
  });
}
