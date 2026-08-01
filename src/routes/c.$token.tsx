import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getContractByToken, signContract } from "@/lib/contracts.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatEventDate } from "@/lib/date-format";
import { toast } from "sonner";
import { CheckCircle2, FileText, Download, Eraser } from "lucide-react";
import { ContractDocument } from "@/components/contract-document";
import { tFor } from "@/i18n";

export const Route = createFileRoute("/c/$token")({
  ssr: false,
  component: ClientSigning,
  head: () => ({ meta: [{ title: "Event Agreement" }] }),
});

type SignatureMode = "draw" | "type";

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function ClientSigning() {
  const { token } = Route.useParams();
  const resolve = useServerFn(getContractByToken);
  const sign = useServerFn(signContract);

  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [signedPlace, setSignedPlace] = useState("");
  const [signedDate, setSignedDate] = useState(todayISO());
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [mode, setMode] = useState<SignatureMode>("draw");
  const [hasDrawn, setHasDrawn] = useState(false);
  const tc = tFor(state?.deal?.language);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    resolve({ data: { token } })
      .then((r: any) => {
        if (!r.ok) setError(r.reason ?? "not_found");
        else {
          setState(r);
          if (r.contract.signed_at) {
            setSignedAt(r.contract.signed_at);
            if (r.contract.signature_data) setSignatureImage(r.contract.signature_data);
          }
        }
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, [token, resolve]);

  // Setup high-DPR canvas
  useEffect(() => {
    if (mode !== "draw" || signedAt) return;
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, [mode, signedAt]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPtRef.current = pointerPos(e);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pointerPos(e);
    const last = lastPtRef.current!;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPtRef.current = p;
    if (!hasDrawn) setHasDrawn(true);
  }
  function onPointerUp() {
    drawingRef.current = false;
    lastPtRef.current = null;
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setHasDrawn(false);
  }

  function exportDrawnPng(): string | null {
    const c = canvasRef.current;
    if (!c || !hasDrawn) return null;
    return c.toDataURL("image/png");
  }

  function exportTypedPng(): string | null {
    if (!typedName.trim()) return null;
    const text = typedName.trim();
    const w = 600;
    const h = 140;
    const dpr = window.devicePixelRatio || 1;
    const c = document.createElement("canvas");
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#111";
    ctx.font = 'italic 56px "Segoe Script","Brush Script MT",cursive';
    ctx.textBaseline = "middle";
    ctx.fillText(text, 12, h / 2);
    return c.toDataURL("image/png");
  }

  const signatureReady = mode === "draw" ? hasDrawn : typedName.trim().length > 0;
  const canSubmit =
    !!typedName.trim() &&
    !!signedPlace.trim() &&
    !!signedDate &&
    agreed &&
    signatureReady &&
    !busy;

  async function onSign() {
    if (!canSubmit) return;
    const image = mode === "draw" ? exportDrawnPng() : exportTypedPng();
    if (!image) {
      toast.error(tc("client.signature_required") as string);
      return;
    }
    setBusy(true);
    try {
      const r: any = await sign({
        data: {
          token,
          typed_name: typedName.trim(),
          signed_place: signedPlace.trim(),
          signed_date: signedDate,
          signature_image: image,
          agreed: true,
        },
      });
      if (r.ok) {
        setSignedAt(r.signed_at);
        setSignatureImage(r.signature_image);
        // Refresh contract body so the rendered signature appears immediately.
        try {
          const fresh: any = await resolve({ data: { token } });
          if (fresh?.ok) setState(fresh);
        } catch {}
        toast.success(tc("client.contract_signed") as string);
      }
    } catch (e: any) {
      toast.error(e?.message ?? (tc("client.sign_failed") as string));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">{tc("client.link_not_available")}</h1>
        <p className="mt-2 text-muted-foreground">
          {error === "expired"
            ? tc("client.link_expired_body")
            : error === "not_available"
              ? tc("client.link_not_available_body")
              : tc("client.link_not_found_body")}
        </p>
      </div>
    );
  }

  if (!state) {
    return <div className="mx-auto max-w-xl px-6 py-16 text-center text-muted-foreground">{tc("client.contract_loading")}</div>;
  }

  const { contract, company, deal } = state;
  const isSigned = !!signedAt;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 printable">
      <style>{`
        @media print {
          .printable button, .printable [role="button"] { display: none !important; }
          .printable .max-h-\\[60vh\\],
          .printable [class*="max-h-"] { max-height: none !important; overflow: visible !important; }
          .printable .overflow-y-auto,
          .printable .overflow-auto { overflow: visible !important; }
        }
      `}</style>
      <div className="mb-6 flex items-center gap-3">
        {company?.logo_url ? (
          <img src={company.logo_url} alt="" className="h-10 w-10 rounded object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted-foreground">{company?.name}</div>
          <h1 className="text-xl font-semibold">
            {deal?.client_name
              ? `${tc("client.event_agreement")} — ${deal.client_name}`
              : tc("client.event_agreement")}
          </h1>
        </div>
        <div className="no-print">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="mr-1 h-4 w-4" /> {tc("client.download_pdf")}
          </Button>
        </div>
      </div>


      {deal && (
        <Card className="mb-4">
          <CardContent className="grid grid-cols-2 gap-3 py-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">{tc("client.client")}</div>
              <div className="font-medium">{deal.client_name || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tc("client.company")}</div>
              <div className="font-medium">{deal.client_company || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tc("client.event_date")}</div>
              <div className="font-medium">
                {deal.event_date ? formatEventDate(deal.event_date) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tc("client.guest_count")}</div>
              <div className="font-medium">{deal.guest_count ?? "—"}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tc("client.contract_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractDocument
            html={contract.rendered_body ?? ""}
            className="max-h-[60vh] overflow-y-auto rounded-md border bg-background p-4"
          />
        </CardContent>
      </Card>

      {isSigned ? (
        <Card className="mt-4 border-green-600/40 bg-green-50 dark:bg-green-950/20">
          <CardContent className="flex items-start gap-3 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
            <div className="flex-1 text-sm">
              <div className="font-medium">{tc("client.contract_signed")}</div>
              <div className="text-muted-foreground">
                {tc("client.signed_by_on")} {contract.signed_by_name ?? typedName}{" "}
                {tc("client.signed_on")} {new Date(signedAt!).toLocaleString()}
                {contract.signed_place
                  ? ` ${tc("client.signed_in")} ${contract.signed_place}`
                  : ""}
                . {tc("client.copy_saved_by")} {company?.name}.
              </div>
              {signatureImage && (
                <div className="mt-3 rounded-md border bg-background p-2 inline-block">
                  <img
                    src={signatureImage}
                    alt="Signature"
                    style={{ maxHeight: 80 }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">{tc("client.sign_contract")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="typed">{tc("client.full_legal_name")}</Label>
                <Input
                  id="typed"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={tc("client.full_legal_name_placeholder") as string}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="place">{tc("client.place_label")}</Label>
                <Input
                  id="place"
                  value={signedPlace}
                  onChange={(e) => setSignedPlace(e.target.value)}
                  placeholder={tc("client.place_placeholder") as string}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sdate">{tc("client.date_label")}</Label>
                <Input
                  id="sdate"
                  type="date"
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{tc("client.signature_label")}</Label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    className={`rounded px-2 py-1 ${mode === "draw" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => setMode("draw")}
                  >
                    {tc("client.signature_draw")}
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-1 ${mode === "type" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => setMode("type")}
                  >
                    {tc("client.signature_type")}
                  </button>
                </div>
              </div>

              {mode === "draw" ? (
                <div className="space-y-2">
                  <div className="rounded-md border bg-background">
                    <canvas
                      ref={canvasRef}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerLeave={onPointerUp}
                      onPointerCancel={onPointerUp}
                      style={{
                        width: "100%",
                        height: 160,
                        touchAction: "none",
                        display: "block",
                        cursor: "crosshair",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{tc("client.signature_draw_hint")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearCanvas}
                      disabled={!hasDrawn}
                    >
                      <Eraser className="mr-1 h-3.5 w-3.5" /> {tc("client.signature_clear")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border bg-muted/30 px-3 py-4 min-h-[80px] flex items-center">
                  <span
                    style={{
                      fontFamily: '"Segoe Script","Brush Script MT",cursive',
                      fontStyle: "italic",
                      fontSize: 32,
                    }}
                  >
                    {typedName || (
                      <span className="text-muted-foreground text-base not-italic">
                        {tc("client.signature_type_hint")}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <span>
                {tc("client.sign_agreement_text")}
              </span>
            </label>
            <div className="flex justify-end">
              <Button onClick={onSign} disabled={!canSubmit}>
                {busy ? tc("client.signing_now") : tc("client.sign_contract")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
