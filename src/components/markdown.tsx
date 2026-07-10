import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

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
