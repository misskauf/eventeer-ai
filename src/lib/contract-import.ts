// Client-side conversion of uploaded contract documents (.docx, .pdf, .txt, .md)
// into HTML for the TipTap editor, plus placeholder auto-detection helpers.

import { CONTRACT_PLACEHOLDERS } from "@/lib/contracts";

export type ParsedDoc = {
  html: string;
  warnings: string[];
};

export type DetectedCandidate = {
  // The exact literal text that appears in the HTML (as plain text) that we
  // want to replace. Multiple occurrences are all replaced with the same key.
  token: string;
  // A human-friendly display label — often the same as token.
  label: string;
  // Best-guess placeholder key (may be undefined if we can't guess).
  suggestedKey?: string;
  // How many times it appears in the document.
  count: number;
};

const MAX_BYTES = 5 * 1024 * 1024;

export function validateFileSize(file: File) {
  if (file.size > MAX_BYTES) {
    throw new Error("File is larger than 5 MB. Please upload a smaller document.");
  }
}

// ---------- Parsers ----------

export async function parseDocx(file: File): Promise<ParsedDoc> {
  validateFileSize(file);
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer: buf });
  return {
    html: result.value || "",
    warnings: (result.messages ?? []).map((m: any) => String(m.message ?? m)),
  };
}

export async function parsePdf(file: File): Promise<ParsedDoc> {
  validateFileSize(file);
  const pdfjs: any = await import("pdfjs-dist");
  // Wire up the worker via Vite's ?url import.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const paragraphs: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Group text items by their `transform[5]` Y coordinate to reconstruct lines.
    const lines: { y: number; text: string }[] = [];
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform?.[5] ?? 0);
      const text = String(item.str ?? "");
      if (!text) continue;
      const existing = lines.find((l) => Math.abs(l.y - y) < 2);
      if (existing) existing.text += (item.hasEOL ? "\n" : "") + text;
      else lines.push({ y, text });
    }
    lines.sort((a, b) => b.y - a.y);
    let buffer: string[] = [];
    const flush = () => {
      const joined = buffer.join(" ").trim();
      if (joined) paragraphs.push(joined);
      buffer = [];
    };
    for (const line of lines) {
      const t = line.text.trim();
      if (!t) flush();
      else buffer.push(t);
    }
    flush();
  }

  const html = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return {
    html,
    warnings: ["PDF text was extracted without original layout — headings, columns, and images are simplified."],
  };
}

export async function parseMarkdown(file: File): Promise<ParsedDoc> {
  validateFileSize(file);
  const { marked } = await import("marked");
  const text = await file.text();
  const html = await marked.parse(text, { async: true });
  return { html: String(html), warnings: [] };
}

export async function parseText(file: File): Promise<ParsedDoc> {
  validateFileSize(file);
  const text = await file.text();
  const html = text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return { html, warnings: [] };
}

export async function parseFile(file: File): Promise<ParsedDoc> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return parseDocx(file);
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".md") || name.endsWith(".markdown")) return parseMarkdown(file);
  if (name.endsWith(".txt")) return parseText(file);
  // Fallback by MIME type
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return parseDocx(file);
  if (file.type === "application/pdf") return parsePdf(file);
  if (file.type === "text/markdown") return parseMarkdown(file);
  if (file.type.startsWith("text/")) return parseText(file);
  throw new Error(`Unsupported file type: ${file.name}`);
}

// ---------- Placeholder detection ----------

// Common patterns for existing placeholder-like tokens in uploaded docs.
const TOKEN_PATTERNS: RegExp[] = [
  /\[([A-Z][A-Z0-9 _/-]{1,40})\]/g, // [CLIENT NAME]
  /\{([A-Za-z][A-Za-z0-9 _-]{1,40})\}/g, // {client_name}
  /<<\s*([A-Za-z][A-Za-z0-9 _-]{1,40})\s*>>/g, // <<client name>>
];

// Field label followed by a run of underscores (e.g. "Client Name: __________")
const LABELED_BLANK = /([A-Za-z][A-Za-z0-9 &/'-]{1,40}?)\s*[:\-]\s*_{3,}/g;

function stripHtml(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, " ");
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Very small keyword map from common contract labels to placeholder keys.
const LABEL_HINTS: Array<{ match: RegExp; key: string }> = [
  { match: /client.*(name|full)/, key: "client_name" },
  { match: /client.*company|company.*name(?!.*ours)/, key: "client_company" },
  { match: /client.*email|e[- ]?mail/, key: "client_email" },
  { match: /event.*date|date.*event|wedding date|function date/, key: "event_date" },
  { match: /guest|attendee|pax/, key: "guest_count" },
  { match: /hours|duration/, key: "event_hours" },
  { match: /venue|space|room|location/, key: "venue" },
  { match: /food|menu.*package|catering/, key: "food_package" },
  { match: /drink|beverage|bar package/, key: "drinks_package" },
  { match: /menu.*selection|selected.*menu/, key: "menu_selections" },
  { match: /extras|add[- ]?ons/, key: "extras" },
  { match: /subtotal/, key: "subtotal" },
  { match: /\btax\b|vat/, key: "tax" },
  { match: /total|grand total|amount due/, key: "total" },
  { match: /currency/, key: "currency" },
  { match: /today|date signed|signature date/, key: "today" },
  { match: /company.*(logo)/, key: "company_logo" },
  { match: /company.*(address|street)/, key: "company_address" },
  { match: /company.*(email)/, key: "company_email" },
  { match: /company.*(phone|tel)/, key: "company_phone" },
  { match: /company.*(website|url)/, key: "company_website" },
  { match: /company.*(name)|our company|business name/, key: "company_name" },
];

function guessKey(label: string): string | undefined {
  const norm = normalizeLabel(label);
  for (const hint of LABEL_HINTS) {
    if (hint.match.test(norm)) return hint.key;
  }
  return undefined;
}

export function detectPlaceholderCandidates(html: string): DetectedCandidate[] {
  const text = stripHtml(html);
  const found = new Map<string, DetectedCandidate>();

  const add = (token: string, label: string, suggestedKey?: string) => {
    const trimmed = token.trim();
    if (!trimmed) return;
    // Skip if already a live placeholder token like {{key}}
    if (/^\{\{[a-z_]+\}\}$/i.test(trimmed)) return;
    const existing = found.get(trimmed);
    if (existing) {
      existing.count += 1;
      if (!existing.suggestedKey && suggestedKey) existing.suggestedKey = suggestedKey;
    } else {
      found.set(trimmed, {
        token: trimmed,
        label: label.trim() || trimmed,
        suggestedKey,
        count: 1,
      });
    }
  };

  for (const re of TOKEN_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const inner = m[1];
      add(m[0], inner, guessKey(inner));
    }
  }

  LABELED_BLANK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LABELED_BLANK.exec(text))) {
    // Replace the underscores run itself, tied to the preceding label.
    const label = m[1];
    const blankMatch = m[0].match(/_{3,}/);
    if (!blankMatch) continue;
    // Use "label: ______" as the token so the underscores get replaced in context.
    add(m[0], label, guessKey(label));
  }

  return Array.from(found.values()).sort((a, b) => b.count - a.count);
}

// Replace every occurrence of `token` in the HTML with the placeholder text
// {{key}}. Operates on text nodes so it doesn't rewrite tag attributes.
export function applyPlaceholderMap(html: string, map: Record<string, string>): string {
  if (typeof window === "undefined") return html;
  const entries = Object.entries(map).filter(([, key]) => key);
  if (entries.length === 0) return html;

  const container = document.createElement("div");
  container.innerHTML = html;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);

  for (const node of textNodes) {
    let value = node.nodeValue ?? "";
    for (const [token, key] of entries) {
      // Escape regex specials in the token
      const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      value = value.replace(re, `{{${key}}}`);
    }
    if (value !== node.nodeValue) node.nodeValue = value;
  }

  return container.innerHTML;
}

export const PLACEHOLDER_OPTIONS = CONTRACT_PLACEHOLDERS;
