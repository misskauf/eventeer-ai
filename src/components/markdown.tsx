import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { ContractDocument } from "@/components/contract-document";

export function Markdown({ source, className }: { source?: string | null; className?: string }) {
  if (!source) return null;
  const html = DOMPurify.sanitize(marked.parse(source, { async: false }) as string);
  return (
    <div
      className={"prose prose-sm max-w-none dark:prose-invert " + (className ?? "")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Client-facing rich text. Values saved by the rich-text editor are HTML and
 * render through the shared sanitized document renderer; legacy plain-text /
 * Markdown values still render as paragraphs via the Markdown renderer.
 */
export function RichText({ source, className }: { source?: string | null; className?: string }) {
  const value = (source ?? "").trim();
  if (!value) return null;
  if (value.startsWith("<")) return <ContractDocument html={value} className={className} />;
  return <Markdown source={value} className={className} />;
}
