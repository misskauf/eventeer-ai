import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";
import {
  parseFile,
  detectPlaceholderCandidates,
  applyPlaceholderMap,
  PLACEHOLDER_OPTIONS,
  type DetectedCandidate,
} from "@/lib/contract-import";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (result: { name: string; html: string }) => void;
  /** Placeholder list for the mapping step (defaults to contract placeholders). */
  placeholders?: Array<{ key: string; label: string }>;
  /** Document kind shown in the dialog copy, e.g. "event brief" or "invoice". */
  docLabel?: string;
};

type Stage = "pick" | "mapping";

export function ContractUploadDialog({
  open,
  onOpenChange,
  onImport,
  placeholders = PLACEHOLDER_OPTIONS,
  docLabel = "contract",
}: Props) {
  const [stage, setStage] = useState<Stage>("pick");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [html, setHtml] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<DetectedCandidate[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  function reset() {
    setStage("pick");
    setBusy(false);
    setFile(null);
    setHtml("");
    setWarnings([]);
    setCandidates([]);
    setMapping({});
  }

  async function handleFile(f: File) {
    setFile(f);
    setBusy(true);
    try {
      const parsed = await parseFile(f);
      setHtml(parsed.html);
      setWarnings(parsed.warnings);
      const detected = detectPlaceholderCandidates(parsed.html);
      setCandidates(detected);
      const initial: Record<string, string> = {};
      for (const c of detected) if (c.suggestedKey) initial[c.token] = c.suggestedKey;
      setMapping(initial);
      setStage("mapping");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to read file");
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    const finalHtml = applyPlaceholderMap(html, mapping);
    const defaultName = (file?.name ?? "Uploaded contract").replace(/\.[^.]+$/, "");
    onImport({ name: defaultName, html: finalHtml });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Import an existing {docLabel} as an editable template. Supported: .docx, .pdf, .txt,
            .md.
          </DialogDescription>
        </DialogHeader>

        {stage === "pick" && (
          <div className="space-y-3">
            <label
              htmlFor="contract-upload-input"
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/20 px-6 py-10 text-center hover:bg-muted/40"
            >
              {busy ? (
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
              )}
              <div className="text-sm font-medium">
                {busy ? "Reading document…" : "Click to choose a file"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Word (.docx) keeps text, headings, tables, lists, bold/italic and inline images.
                PDF text is extracted — layout is simplified. Max 5&nbsp;MB.
              </div>
              <input
                id="contract-upload-input"
                type="file"
                accept=".docx,.pdf,.txt,.md,.markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain,text/markdown"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Complex shapes, text boxes, and exact page layout may not be preserved — imported
              content becomes editable text you can adjust.
            </div>
          </div>
        )}

        {stage === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{file?.name}</span>
            </div>

            <div className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Complex shapes, text boxes, and exact page layout may not be preserved — imported
              content becomes editable text you can adjust.
              {warnings.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer underline underline-offset-2">
                    {warnings.length} conversion note{warnings.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                    {warnings.map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Map detected fields to placeholders</div>
              {candidates.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No placeholder-like fields detected automatically. You can still turn any text
                  into a placeholder from the editor toolbar after import.
                </p>
              ) : (
                <div className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
                  {candidates.map((c) => (
                    <div
                      key={c.token}
                      className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-md border bg-background px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm">{c.token}</div>
                        <div className="text-[10px] text-muted-foreground">
                          appears {c.count}×
                        </div>
                      </div>
                      <Select
                        value={mapping[c.token] ?? ""}
                        onValueChange={(v) =>
                          setMapping((m) => ({ ...m, [c.token]: v === "__skip" ? "" : v }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Skip" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip">Skip</SelectItem>
                          {placeholders.map((p) => (
                            <SelectItem key={p.key} value={p.key}>
                              <span className="font-mono text-xs">{`{{${p.key}}}`}</span>
                              <span className="ml-2 text-muted-foreground">{p.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-right text-[11px] text-muted-foreground">
                        {mapping[c.token] ? `→ {{${mapping[c.token]}}}` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              You'll be able to further edit the template and turn any selected text into a
              placeholder from the editor toolbar.
            </p>
          </div>
        )}

        <DialogFooter>
          {stage === "mapping" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                }}
              >
                Choose another file
              </Button>
              <Button onClick={finish}>Import into editor</Button>
            </>
          )}
          {stage === "pick" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Silence unused-import warning on Label in strict mode
void Label;
