# Real drawn e-signature on the client signing page

## DB migration
- Add `signed_place text` (nullable) to `contracts`.

## `src/lib/contracts.functions.ts` — `signContract`
- Extend input schema: `signature_image` (string, PNG data URL, `startsWith('data:image/')`), `signed_place` (string, 1–200), `signed_date` (ISO date string).
- Fetch existing `rendered_body` along with the current fields.
- Build signed HTML by replacing placeholders in `rendered_body`:
  - `{{client_signature}}` → `<img src="..." style="max-height:60px"/>`
  - `{{client_signature_name}}` → escaped name
  - `{{client_signature_date}}` → formatted date
  - `{{client_signature_place}}` → escaped place
  - If none of those placeholders are present, append a signature block (image + name / place / date) to the end.
- Update `contracts` with: `status='signed'`, `signed_at=now`, `signed_by_name`, `signed_by_email` (from `sent_to_email`), `signed_place`, `signed_ip`, `signature_data = signature_image`, `rendered_body = signedHtml`, clear signing token.
- Keep the existing `notifyDeal('contract_signed', …)` call.

## `src/routes/c.$token.tsx` — Sign contract card
- Replace the single name input with:
  - **Signature pad**: `<canvas>` with pointer events (`pointerdown/move/up`), high-DPR sizing, Clear button, `hasDrawn` flag. On submit, export via `canvas.toDataURL('image/png')`.
  - **Type instead** toggle: renders typed name in cursive on a hidden canvas and exports to PNG so we always store an image.
  - **Full legal name** (required text).
  - **Place / city** (required text).
  - **Date** (date input, default today, required).
  - Keep the agreement checkbox.
- Sign button disabled until name + (drawn or typed signature) + place + date + agreed.
- Pass `signature_image`, `signed_place`, `signed_date` to `signContract`.
- Signed state card: show the signature image, name, place, and date. The contract card automatically shows the updated `rendered_body`. Ensure print stylesheet still displays the image and signed block.

## `src/lib/contracts.ts` — placeholders
- Add to `CONTRACT_PLACEHOLDERS`:
  - `client_signature` — Client signature (image)
  - `client_signature_name` — Client signature name
  - `client_signature_date` — Client signature date
  - `client_signature_place` — Client signature place
- These are filled at signing time, so `buildPlaceholderValues` leaves them as empty strings (or unset) during initial render; the signContract handler substitutes them.

## `src/components/rich-text-editor.tsx` — Insert signature block
- Replace the underscore-lines signature snippet with a two-cell table (or aligned block) using the new placeholders:
  - Client: `{{client_signature}}` image row, name = `{{client_signature_name}}`, place = `{{client_signature_place}}`, date = `{{client_signature_date}}`.
  - Keep the venue side as-is (or mirror it with existing company placeholders).

## Out of scope
- No changes to proposal flow, deal detail page, invoices, or i18n strings.
- No new dependencies.
