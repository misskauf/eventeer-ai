/** Client-side ZIP packaging for the workspace data export. */

export type ExportPayload = {
  companyId: string;
  companyName: string;
  exportedAt: string;
  tables: Record<string, any[]>;
};

function cell(value: unknown) {
  if (value == null) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function tableToCsv(rows: any[]) {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => cell(row[h])).join(","));
  return lines.join("\n");
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "workspace"
  );
}

function readme(payload: ExportPayload) {
  const date = new Date(payload.exportedAt);
  return [
    `Datenexport — ${payload.companyName}`,
    `Exportdatum: ${date.toLocaleString("de-DE")}`,
    "",
    "Inhalt:",
    "- data.json  : vollständiger Export als strukturiertes JSON, ein Schlüssel pro Tabelle.",
    "- csv/*.csv  : je eine CSV-Datei pro Tabelle (UTF-8 mit BOM, kommagetrennt, erste Zeile = Spaltennamen).",
    "",
    "Enthaltene Tabellen:",
    ...Object.keys(payload.tables).map((t) => `- ${t} (${payload.tables[t].length} Zeilen)`),
    "",
    "Hinweise:",
    "- Der Export enthält ausschließlich Daten dieses Workspace.",
    "- Zugangsdaten, Zahlungs-Secrets und Signatur-Tokens sind aus Sicherheitsgründen nicht enthalten.",
    "- Der Export bildet den Datenstand zum Zeitpunkt des Downloads ab.",
    "",
  ].join("\n");
}

/** Build the ZIP and start the browser download. */
export async function downloadExportZip(payload: ExportPayload) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const BOM = "\uFEFF";

  zip.file("data.json", JSON.stringify(payload.tables, null, 2));
  zip.file("README.txt", BOM + readme(payload));

  const csv = zip.folder("csv")!;
  for (const [table, rows] of Object.entries(payload.tables)) {
    csv.file(`${table}.csv`, BOM + tableToCsv(rows));
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const day = payload.exportedAt.slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eventeer-export-${slug(payload.companyName)}-${day}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
