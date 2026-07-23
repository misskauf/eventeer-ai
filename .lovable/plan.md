## Extend Lead Forms with More Fields

### 1. Database (migration)
- `deals.custom_fields jsonb not null default '{}'::jsonb` — stores answers keyed by field id/key.
- `lead_forms.fields` already JSONB — extend its shape (no column change):
  - Existing keys stay as-is.
  - Add optional preset keys: `budget`, `venue_preference`, `hearing_about_us`, `address`, `city`, `company_website` (each `{ enabled, required }`).
  - New `custom` array: `[{ id, key, label, type, required, options?, placeholder?, help? }]` where `type` ∈ `text | textarea | number | date | select | checkbox`.

### 2. Field registry
- New `src/lib/lead-form-fields.ts`:
  - `PRESET_FIELDS` list (built-ins + new presets above) with label, input type, and how each maps to a `deals` column (or falls back to `custom_fields`).
  - Helpers: `defaultFieldsConfig()`, `getEnabledFields(config)`, `validateSubmission(config, values)`, `splitDealVsCustom(config, values)`.
- Mapping rules:
  - `name → contact_name`, `email → contact_email`, `phone → contact_phone`, `company → contact_company`, `event_type → event_type`, `event_date → event_date`, `guest_count → guest_count`, `message → notes`, `budget → budget` (if column exists, else custom), everything else + all `custom[*]` → `deals.custom_fields`.

### 3. Public form (`src/routes/f.$slug.tsx`)
- Render presets + custom fields in defined order.
- Client-side validation (required, type, min/max for number, options for select).
- Submit sends `{ values: Record<string, unknown> }`.

### 4. Server function (`src/lib/lead-forms.functions.ts`)
- `submitLeadForm` validates with Zod against the form's active field config (dynamic schema built from `getEnabledFields`), enforces GDPR checkbox, splits values into deal columns vs `custom_fields`, inserts the deal, logs activity, calls `notifyDeal('lead_created', …)`.

### 5. Admin editor (`src/components/lead-forms-editor.tsx`)
- Two sections inside each form:
  - **Preset fields**: existing + new presets with enabled/required toggles.
  - **Custom fields**: add/remove/reorder rows; each row edits label, type, required, and (for `select`) comma-separated options. `key` auto-derived from label (slug) but editable; uniqueness enforced.
- Persist through existing save flow.

### 6. Deal view surfacing
- In the deal detail page (source-of-lead panel), render `custom_fields` as a labelled key/value list using the originating form's config to resolve labels (fallback to raw key).

### 7. Out of scope
- No file uploads, no conditional logic, no per-field styling, no changes to embed snippet, no email template changes.

### Technical notes
- Zod schema built dynamically per submission; unknown keys stripped.
- `custom_fields` writes go through the same public `submitLeadForm` fn — RLS unchanged (insert allowed via existing policy).
- Editor keeps backward compat: forms without `custom` array behave as today.
