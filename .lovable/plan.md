# Bilingual (EN/DE) Support Across Catalog, Deals, Proposals & Contracts

Per your request, the migration plan is shown first, followed by the app-level changes.

---

## 1. Migration Plan (shown first for review)

Single migration adding German fields, a per-deal language, a template language, and a company default. No data loss — existing text is treated as the English/default value.

```text
companies
  + default_deal_language  text        default 'en'  check in ('en','de')

deals
  + language               text        default 'en'  check in ('en','de')
    (backfilled from companies.default_deal_language on insert via default;
     existing rows set to 'en')

spaces
  + name_de                text        null
  + description_de         text        null
  + long_description_de    text        null

fb_packages
  + name_de                text        null
  + long_description_de    text        null
  (description_de optional — add only if `description` is client-visible; will confirm from schema before writing)

extras
  + name_de                text        null
  + long_description_de    text        null

contract_templates
  + language               text        default 'en'  check in ('en','de')
    (existing rows default to 'en')
```

Notes:
- All new columns are nullable (or defaulted) — no backfill of translations; empty DE fields fall back to the default at read time.
- No RLS/GRANT changes needed (columns added to existing tables).
- No changes to `invoice_templates` in this pass unless you want invoices localized too (ask below).

---

## 2. App changes

### Shared i18n layer
- `src/lib/i18n.ts`: `Lang = 'en' | 'de'`, a `STRINGS` table for all fixed UI copy (section titles: Space / Food / Beverages / Extras, "Choose one", "Your total", "Confirm my selection", "Request changes", "Decline offer", reminder email subject/body, notification copy, print "Download PDF", etc.), and a helper `t(lang, key)` + `pickLocalized(item, lang, field)` that returns `item[field+'_de']` when `lang==='de'` and the value is non-empty, else `item[field]`.

### Catalog editor (Spaces / F&B / Extras)
- Add an EN / DE tab (Tabs component) inside each item editor. EN tab edits `name` / `description` / `long_description`; DE tab edits the `_de` counterparts. Placeholder in DE fields: "Fällt auf Englisch zurück, wenn leer."
- No other editor logic changes; pricing / weekday pricing / hours untouched.

### Contract templates
- Add a Language selector (EN / DE) on the template editor and show a badge in the templates list.
- Contract picker on the deal filters templates by `deal.language` first, with a "Show all languages" toggle as fallback.

### Deals
- `deals_.$id.tsx`: add a compact Language selector (EN / DE) in the deal header, persisted via a small server fn `setDealLanguage`. Changing language re-renders previews but does not mutate stored selections.
- New deals inherit `companies.default_deal_language`.

### Client-facing proposal (`p.$token.tsx`)
- Load `deal.language`; wrap the page in `t(lang, …)` for all fixed strings and `pickLocalized(item, lang, 'name' | 'long_description' | 'description')` for every catalog item rendered (spaces, F&B, beverages, extras, alternative groups).
- Confirm / Request changes / Decline button labels + the notes-dialog copy come from the string table.
- Print/Download PDF label localized.

### Contract page (`c.$token.tsx`) & renderer
- `renderContract` (and any placeholder resolution) receives `lang`. Placeholder *labels* stay as tokens; the resolved values already come from the deal. Fixed chrome ("Event Agreement", signature block labels: Date / Place / Signature, etc.) uses the string table.
- Contract body itself stays whatever the template author wrote — because templates are language-tagged, Keren authors the DE body in a DE template.

### Emails / notifications
- `proposal-reminders.functions.ts` and `notifications.server.ts` (`sendClientEmailAndNotify`) accept the deal's language and pull subject + body from the string table. Internal team notifications stay in EN (they're for staff), unless you want those localized too — see question below.

### Settings
- Add `default_deal_language` selector (EN / DE) to Company settings.

---

## 3. Out of scope (call out if you want them in)
- Invoice template localization (no `language` column on `invoice_templates` in this pass).
- Localizing internal/staff notifications and the manager app UI (only client-facing surfaces + emails are localized here).
- Auto-translation of existing catalog content — you fill DE fields manually via the new tabs.

---

## 4. One quick confirmation before I write the migration
- On `fb_packages` and `extras`, is the short `description` field shown to clients on the proposal, or only `long_description`? If only `long_description`, I'll skip `description_de` on those two tables to keep the schema tight. (I'll verify from the current `p.$token.tsx` before running the migration either way.)
