import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export function LogoUploader({
  companyId,
  logoUrl,
  onChange,
}: {
  companyId: string;
  logoUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${companyId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("company-logos")
        .createSignedUrl(path, TEN_YEARS);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Sign failed");
      onChange(signed.signedUrl);
      toast.success("Logo uploaded — remember to save.");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>Company logo</Label>
      <div className="flex items-center gap-3 rounded-md border p-3">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded object-cover" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded bg-muted text-xs text-muted-foreground">
            No logo
          </div>
        )}
        <div className="flex flex-1 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {logoUrl ? "Replace" : "Upload"}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onChange(null)}
            >
              <X className="mr-2 h-4 w-4" /> Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      <p className="text-xs text-muted-foreground">PNG, JPG, or SVG up to 5 MB.</p>
    </div>
  );
}
