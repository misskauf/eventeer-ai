// Email rendering for the "Send to event manager" brief action.
// Server-safe and client-safe (pure string helpers).

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function briefEmailSubject(opts: { clientName: string; eventDate: string | null }): string {
  const date = opts.eventDate
    ? new Date(opts.eventDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
  return `Event brief — ${opts.clientName}${date ? ` · ${date}` : ""}`;
}

export function renderBriefEmailHtml(opts: {
  title: string;
  message: string;
  /** Already-sanitized brief HTML from the editor. */
  bodyHtml: string;
  dealUrl: string | null;
}): string {
  const note = opts.message
    ? `<div style="background:#f1f5f9;border-radius:6px;padding:12px 14px;color:#334155;font-size:14px;line-height:1.5;margin:0 0 20px">${esc(
        opts.message,
      ).replace(/\n/g, "<br />")}</div>`
    : "";
  const cta = opts.dealUrl
    ? `<p style="margin:24px 0 0"><a href="${esc(
        opts.dealUrl,
      )}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Open the deal for the live version</a></p>`
    : `<p style="margin:24px 0 0;color:#64748b;font-size:13px">Open the deal in the app for the live version of this brief.</p>`;

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f7f8;padding:24px">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 16px 0;color:#0f172a">${esc(opts.title)}</h2>
    ${note}
    <div style="color:#334155;font-size:14px;line-height:1.6">${opts.bodyHtml}</div>
    ${cta}
  </div>
</body></html>`;
}
