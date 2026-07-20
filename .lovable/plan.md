## Changes to the contract template editor

### 1. New templates start empty
In `ContractTemplatesEditor.openNew()` (`src/components/contracts-panel.tsx`), set `body` to `""` instead of `SAMPLE_TEMPLATE`. The `RichTextEditor` already shows the "Start typing…" placeholder in that state. `SAMPLE_TEMPLATE` and its unused import are removed.

### 2. "Insert placeholder" stays
No change — the dropdown in `src/components/rich-text-editor.tsx` keeps its Company + Deal groups exactly as today.

### 3. New "Insert" menu on the toolbar (header, two-column, logo top-right)
Add a single **Insert** dropdown to the toolbar (next to the image button) with three ready-made blocks. Each one calls `editor.chain().focus().insertContent(html).run()` so it drops into the document at the cursor and stays fully editable afterwards.

- **Header (single column)** — a title band using company details:
  ```html
  <div style="border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:16px">
    <h1 style="margin:0">{{company_name}}</h1>
    <p style="margin:4px 0 0;font-size:12px;color:#555">
      {{company_address}} · {{company_email}} · {{company_phone}}
    </p>
  </div>
  ```
- **Two-column header** — company details left, logo right, using a CSS flex row so it renders the same in the editor, the manager preview and the client signing view:
  ```html
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:16px">
    <div>
      <h1 style="margin:0">{{company_name}}</h1>
      <p style="margin:4px 0 0;font-size:12px;color:#555">
        {{company_address}}<br/>{{company_email}} · {{company_phone}}
      </p>
    </div>
    <div style="text-align:right">{{company_logo}}</div>
  </div>
  ```
- **Logo top-right** — just the logo, floated to the top-right of whatever follows:
  ```html
  <div style="display:flex;justify-content:flex-end;margin-bottom:12px">{{company_logo}}</div>
  ```

All three use existing placeholders from `CONTRACT_PLACEHOLDERS`, so `renderContract` fills them from the company profile at contract-creation time — the manager doesn't have to retype anything, and blank profile fields render as empty strings (already handled in `buildPlaceholderValues`).

### 4. Where the UI lives
- Toolbar dropdown added inside `Toolbar` in `src/components/rich-text-editor.tsx` (shadcn `DropdownMenu`, label "Insert block", icon `LayoutTemplate` from `lucide-react`). Positioned right before the placeholder select so the toolbar layout stays balanced.
- No change to how templates are saved or rendered — the blocks are plain HTML that already round-trips through TipTap, DOMPurify sanitisation, and the `.prose` viewer.

## Out of scope
- No new placeholders, no schema change, no changes to the manager preview or client signing view.
- The earlier "wrong company_id on Settings" bug is separate; I'll address it in a follow-up if you still hit "row violates row-level security policy" after these edits.
