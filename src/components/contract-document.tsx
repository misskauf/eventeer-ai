import DOMPurify from "isomorphic-dompurify";
import { ensureHtml } from "@/lib/contracts";

// Single shared renderer for contract HTML — used by the template editor
// preview, the internal deal contract preview, and the client signing page,
// so they can never diverge.
const ALLOWED_TAGS = [
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "hr", "br", "div", "span",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
  "img", "a", "figure", "figcaption",
  "strong", "em", "u", "b", "i", "s", "sub", "sup", "mark", "small",
  "blockquote", "pre", "code",
];
const ALLOWED_ATTR = [
  "style", "href", "src", "alt", "target", "rel",
  "colspan", "rowspan", "class", "width", "height",
  "align", "valign", "colwidth", "span",
  "data-color", "data-text-align", "data-background-color", "data-colwidth",
];

export function ContractDocument({
  html,
  className,
}: {
  html?: string | null;
  className?: string;
}) {
  const clean = DOMPurify.sanitize(ensureHtml(html ?? ""), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ["style", "target"],
  });
  return (
    <div
      className={
        "contract-html prose prose-sm max-w-none dark:prose-invert " +
        (className ?? "")
      }
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
