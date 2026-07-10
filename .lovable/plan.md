# Editable deals + full proposal personalization

Turn the deal detail page into a proper deal + proposal workspace, and let the client both pick between alternatives and leave notes back to you.

## 1. Edit deal info

- Add an **Edit deal** button in the deal detail header opening a dialog with: client name, client email, client company, event type, event date, guest count, notes.
- Save updates the `deals` row and logs a `deal_updated` activity.

## 2. Proposal builder (manager side)

Reorganize `/deals/:id` into two clearly labeled sections:

- **Deal** — read-only summary card + Edit button.
- **Proposal** — everything below, with a heading, a "Preview as client" button (opens the client view in a new tab), and the existing Save draft / Send to client actions.

New fields on the proposal:

- **Cover title** (e.g. "Your winter wedding at Villa Rosa") — text input.
- **Intro message** — upgrade the existing "Client message" into a Markdown-supported textarea with a live preview toggle.
- **Alternative groups** — a new "Add option group" control. Each group has:
  - Name (e.g. "Dinner choice", "Bar option")
  - Category (Food / Beverage / Extra)
  - 2+ items picked from the catalog, one marked as the default
  - The client must pick exactly one from the group.
- Existing single-select spaces / food / beverage / extras stay for items where there's no choice to offer.

## 3. Client page (`/p/:token`)

- Apply the company's logo, primary color, and cover title as a branded header (already partly done — extend with the cover title and a hero band).
- Render the intro message as Markdown.
- For each alternative group, show a radio-style card set — client picks one.
- For each item, add a small "Add a note" toggle where the client can leave a per-item comment.
- Add an overall **"Message to the event manager"** textarea at the bottom.
- Confirm button submits the selection + comments back.

## 4. Manager sees client feedback

- After a client submits, show their selections + all comments in a new **Client response** card on the deal page, and log a `client_responded` activity.
- Manager can then adjust and send a new version, or accept and move the stage forward.

## Technical notes

- Extend the proposal `offer` JSON with `cover_title`, `alternative_groups: [{ id, name, category, item_ids, default_id }]`; keep single-select fields as-is so old proposals still render.
- Extend `constraints` JSON with `intro_markdown` (replaces raw `client_message`, but fall back to it for old rows).
- Add a `client_response` JSON column to `proposals` (or reuse `constraints.client_response`) with `{ selected_alternatives, item_notes, overall_message, submitted_at }`.
- Pricing engine (`src/lib/pricing.ts`) resolves each alternative group into its selected item before running `computeTotals` — no engine rewrite needed.
- "Preview as client" reuses the existing `/p/:token` view against a manager-only draft token so no live token is created until the manager sends.

## Out of scope this round

Contracts, e-signature, invoicing, and payment reminders — those come later in the pipeline you already outlined.
