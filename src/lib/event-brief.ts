// Builds the auto-generated sections of an internal Event Brief.
// Reuses the same ContractContext / buildPlaceholderValues data the contract
// renderer uses, so names, dates and packages read identically everywhere.

import { buildPlaceholderValues, type ContractContext } from "@/lib/contracts";

export type BriefExtras = {
  /** Deal owner display name/email, if known. */
  ownerLabel?: string | null;
  /** Client phone, if the deal captured one. */
  clientPhone?: string | null;
  /** Deal stage/status label. */
  statusLabel?: string | null;
  /** Allergen / dietary notes collected from the selected packages. */
  allergenNotes?: string[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A filled row: label + value (value may already be HTML from placeholders). */
function row(label: string, valueHtml: string): string {
  return `<p style="margin:0 0 4px"><strong>${esc(label)}:</strong> ${valueHtml || "—"}</p>`;
}

/** A blank row the team fills in — visible as a rule on screen and in print. */
function blank(label: string, hint?: string): string {
  const h = hint ? ` <span style="color:#888;font-size:12px">(${esc(hint)})</span>` : "";
  return `<p style="margin:0 0 4px"><strong>${esc(label)}:</strong> _______________________${h}</p>`;
}

function section(title: string, inner: string): string {
  return `<h2>${esc(title)}</h2>${inner}`;
}

export function buildBriefHtml(ctx: ContractContext, extra: BriefExtras = {}): string {
  const v = buildPlaceholderValues(ctx);
  const deal: any = ctx.deal ?? {};

  const overview = section(
    "Event overview",
    [
      row("Client", esc(String(deal.client_name ?? "—"))),
      row("Client company", esc(String(deal.client_company ?? "—"))),
      row("Event type", esc(String(deal.event_type ?? "—"))),
      row("Date", v.event_date),
      row("Guests", v.guest_count),
      row("Status", esc(String(extra.statusLabel ?? deal.stage ?? "—"))),
    ].join(""),
  );

  const contacts = section(
    "Contacts",
    [
      row("Client email", esc(String(deal.client_email ?? "—"))),
      extra.clientPhone
        ? row("Client phone", esc(extra.clientPhone))
        : blank("Client phone"),
      row("Deal owner", esc(String(extra.ownerLabel ?? "—"))),
      blank("On-site contact", "name + mobile"),
    ].join(""),
  );

  const spaceTiming = section(
    "Space & timing",
    [
      row("Space(s)", v.venue),
      row("Event hours", v.event_hours),
      blank("Arrival / setup"),
      blank("Guest arrival"),
      blank("Event start"),
      blank("Event end"),
      blank("Teardown complete"),
    ].join(""),
  );

  const allergens =
    extra.allergenNotes && extra.allergenNotes.length
      ? `<ul>${extra.allergenNotes.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`
      : "";

  const fb = section(
    "Food & beverage",
    [
      row("Food package", v.food_package),
      row("Drinks package", v.drinks_package),
      row("Menu selections", v.menu_selections),
      allergens
        ? `<p style="margin:8px 0 4px"><strong>Allergen notes (from packages):</strong></p>${allergens}`
        : blank("Allergen notes"),
      blank("Client dietary requests", "vegan, gluten-free, counts"),
      blank("Service style / timings"),
    ].join(""),
  );

  const extrasStaff = section(
    "Extras & staffing",
    [
      `<p style="margin:0 0 4px"><strong>Extras:</strong></p>${v.extras}`,
      `<p style="margin:8px 0 4px"><strong>Staffing:</strong></p>${v.staff}`,
      blank("Supplier / vendor arrivals"),
    ].join(""),
  );

  const notes = section(
    "Team notes / run-of-show",
    `<p style="color:#888">Add the run-of-show, briefing points, key moments and anything the team needs on the day.</p><p></p><p></p>`,
  );

  return [overview, contacts, spaceTiming, fb, extrasStaff, notes].join("<hr/>");
}
