# New deal dialog: include all lead-form fields

Today the manual "New deal" dialog has a fixed set of inputs (name, email, company, event type, date, guests, notes), while lead forms can collect many more preset fields (phone, budget, city, venue preference, etc.) plus custom fields. Manually created deals therefore miss data that web-submitted leads capture.

## What changes

The "New deal" dialog will render the union of all fields enabled on the workspace's active lead forms, deduplicated:

- Core fields stay first and unchanged: client name, email, company, event type, event date, guests, notes.
- Any additional preset fields enabled on at least one active lead form get added (phone, budget, venue preference, how-did-you-hear, address, city, company website, etc.), using each field's proper input type.
- All custom fields from active lead forms are added below, grouped under a small "Additional details" heading, using their configured label, type (text, textarea, number, date, select, checkbox) and placeholder/help text.
- A field is marked required only if it is required on every active form that includes it; otherwise it stays optional, so manual entry is never blocked.
- If there are no active lead forms, the dialog looks exactly as it does today.

On submit, values map exactly the same way as a public lead submission: preset fields with a matching deal column write to that column, everything else is saved into the deal's custom fields, so the deal detail page shows them in the existing "Additional details" block with the right labels.

## Technical notes

- Reuse `src/lib/lead-forms.ts` (`normalizeFields`, `PRESET_FIELDS`, `getEnabledPresetFields`, `splitDealVsCustom`) — no duplicated field logic.
- In `src/routes/_authenticated/deals.index.tsx`, the `NewDealDialog` loads active `lead_forms` for the company (id, fields) once when opened, merges their normalized configs into a single field list, and renders extra inputs after the existing core inputs.
- The insert keeps `source: "manual"` behaviour (no lead_form_id, no consent fields) and adds `custom_fields` built from the extra values.
- No database migration, no change to public lead-form submission, deal detail rendering, or pricing.
