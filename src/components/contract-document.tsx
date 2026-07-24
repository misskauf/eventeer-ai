import DOMPurify from "isomorphic-dompurify";
import { ensureHtml } from "@/lib/contracts";

// Single shared renderer for contract HTML — used by the template editor
// preview, the internal deal contract preview, and the client signing page,
// so they can never diverge.
const ALLOWED_TAGS = [
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4",
  "p", "hr", "br", "div", "span",
  "table", "thead", "tbody", "tr", "td", "th",
  "img", "a",
  "strong", "em", "u", "b", "i",
  "blockquote", "pre", "code",
];
const ALLOWED_ATTR = [
  "style", "href", "src", "alt", "target", "rel",
  "colspan", "rowspan", "class", "width", "height",
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
