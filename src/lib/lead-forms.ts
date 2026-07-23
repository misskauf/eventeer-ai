export type PresetFieldKey =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "event_type"
  | "event_date"
  | "guest_count"
  | "message"
  | "budget"
  | "venue_preference"
  | "hearing_about_us"
  | "address"
  | "city"
  | "company_website";

/** @deprecated Use PresetFieldKey */
export type LeadFieldKey = PresetFieldKey;

export type FieldInputType = "text" | "email" | "tel" | "date" | "number" | "textarea" | "select" | "checkbox";

export type PresetFieldMeta = {
  key: PresetFieldKey;
  label: string;
  type: FieldInputType;
  /** Column on `deals` that receives the value; when null, it lands in `custom_fields`. */
  dealColumn: string | null;
};

export const PRESET_FIELDS: PresetFieldMeta[] = [
  { key: "name", label: "Full name", type: "text", dealColumn: "client_name" },
  { key: "email", label: "Email", type: "email", dealColumn: "client_email" },
  { key: "phone", label: "Phone", type: "tel", dealColumn: null },
  { key: "company", label: "Company", type: "text", dealColumn: "client_company" },
  { key: "company_website", label: "Company website", type: "text", dealColumn: null },
  { key: "event_type", label: "Event type", type: "text", dealColumn: "event_type" },
  { key: "event_date", label: "Event date", type: "date", dealColumn: "event_date" },
  { key: "guest_count", label: "Guest count", type: "number", dealColumn: "guest_count" },
  { key: "budget", label: "Estimated budget", type: "number", dealColumn: null },
  { key: "venue_preference", label: "Preferred venue / space", type: "text", dealColumn: null },
  { key: "hearing_about_us", label: "How did you hear about us?", type: "text", dealColumn: null },
  { key: "address", label: "Address", type: "text", dealColumn: null },
  { key: "city", label: "City", type: "text", dealColumn: null },
  { key: "message", label: "Message", type: "textarea", dealColumn: null },
];

/** Backwards-compat alias (older imports). */
export const LEAD_FIELDS = PRESET_FIELDS;

export type PresetFieldConfig = { enabled: boolean; required: boolean };
export type PresetFieldsMap = Partial<Record<PresetFieldKey, PresetFieldConfig>>;

export type CustomFieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox";
export type CustomFieldDef = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
};

export type LeadFieldsConfig = {
  preset: Required<Record<PresetFieldKey, PresetFieldConfig>>;
  custom: CustomFieldDef[];
};

const DEFAULT_ENABLED: PresetFieldKey[] = [
  "name",
  "email",
  "phone",
  "company",
  "event_type",
  "event_date",
  "guest_count",
  "message",
];

export function defaultFieldsConfig(): LeadFieldsConfig {
  const preset = {} as LeadFieldsConfig["preset"];
  for (const f of PRESET_FIELDS) {
    const enabled = DEFAULT_ENABLED.includes(f.key);
    preset[f.key] = {
      enabled,
      required: enabled && (f.key === "name" || f.key === "email"),
    };
  }
  return { preset, custom: [] };
}

/** Legacy default shape kept for older imports. */
export const DEFAULT_FIELDS = defaultFieldsConfig().preset;

function coerceCustom(input: unknown): CustomFieldDef[] {
  if (!Array.isArray(input)) return [];
  const out: CustomFieldDef[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as any;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!label) continue;
    const rawKey = typeof r.key === "string" && r.key.trim() ? r.key : label;
    const key = slugKey(rawKey);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const type: CustomFieldType = ["text", "textarea", "number", "date", "select", "checkbox"].includes(r.type)
      ? r.type
      : "text";
    const options = Array.isArray(r.options)
      ? r.options.map((o: unknown) => String(o).trim()).filter(Boolean)
      : undefined;
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : cryptoRandomId(),
      key,
      label,
      type,
      required: !!r.required,
      options: type === "select" ? options ?? [] : undefined,
      placeholder: typeof r.placeholder === "string" ? r.placeholder : undefined,
      help: typeof r.help === "string" ? r.help : undefined,
    });
  }
  return out;
}

export function normalizeFields(input: unknown): LeadFieldsConfig {
  const base = defaultFieldsConfig();
  if (!input || typeof input !== "object") return base;

  const src = input as any;
  // New shape: { preset, custom }
  const presetSrc = src.preset && typeof src.preset === "object" ? src.preset : src;

  const preset = { ...base.preset };
  for (const f of PRESET_FIELDS) {
    const v = presetSrc[f.key];
    if (v && typeof v === "object") {
      preset[f.key] = {
        enabled: v.enabled !== false,
        required: !!v.required && v.enabled !== false,
      };
    } else if (v === undefined) {
      // Missing preset key -> keep default (disabled for new presets)
      preset[f.key] = base.preset[f.key];
    }
  }

  const custom = coerceCustom(src.custom);
  return { preset, custom };
}

export function getEnabledPresetFields(cfg: LeadFieldsConfig): PresetFieldMeta[] {
  return PRESET_FIELDS.filter((f) => cfg.preset[f.key]?.enabled);
}

export type SubmissionValues = Record<string, unknown>;

export function slugKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

/**
 * Validate a submission against the form's field config.
 * Returns a normalized values map or throws with a human error listing missing fields.
 */
export function validateSubmission(
  cfg: LeadFieldsConfig,
  values: SubmissionValues,
): SubmissionValues {
  const out: SubmissionValues = {};
  const missing: string[] = [];

  for (const f of getEnabledPresetFields(cfg)) {
    const raw = values[f.key];
    const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (empty) {
      if (cfg.preset[f.key].required) missing.push(f.label);
      continue;
    }
    if (f.type === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) missing.push(`${f.label} (must be a number)`);
      else out[f.key] = n;
    } else {
      out[f.key] = typeof raw === "string" ? raw.trim() : raw;
    }
  }

  // Always require name + email to create a deal
  if (!out["name"]) missing.push("Full name");
  if (!out["email"]) missing.push("Email");

  for (const c of cfg.custom) {
    const raw = values[c.key];
    const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "") || (c.type === "checkbox" && !raw);
    if (empty) {
      if (c.required) missing.push(c.label);
      continue;
    }
    if (c.type === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) missing.push(`${c.label} (must be a number)`);
      else out[c.key] = n;
    } else if (c.type === "checkbox") {
      out[c.key] = !!raw;
    } else if (c.type === "select") {
      const s = String(raw);
      if (c.options && c.options.length && !c.options.includes(s)) {
        missing.push(`${c.label} (invalid option)`);
      } else out[c.key] = s;
    } else {
      out[c.key] = typeof raw === "string" ? raw.trim() : raw;
    }
  }

  if (missing.length) {
    throw new Error(`Please complete: ${Array.from(new Set(missing)).join(", ")}`);
  }
  return out;
}

/**
 * Split validated values into (a) deal column patch and (b) custom_fields JSON.
 * Preset fields with a `dealColumn` go to the patch; everything else goes to custom_fields.
 */
export function splitDealVsCustom(
  cfg: LeadFieldsConfig,
  values: SubmissionValues,
): { dealPatch: Record<string, unknown>; customFields: Record<string, { label: string; value: unknown }> } {
  const dealPatch: Record<string, unknown> = {};
  const customFields: Record<string, { label: string; value: unknown }> = {};

  for (const f of PRESET_FIELDS) {
    if (!(f.key in values)) continue;
    const val = values[f.key];
    if (f.dealColumn) {
      dealPatch[f.dealColumn] = val;
    } else {
      customFields[f.key] = { label: f.label, value: val };
    }
  }

  for (const c of cfg.custom) {
    if (!(c.key in values)) continue;
    customFields[c.key] = { label: c.label, value: values[c.key] };
  }

  return { dealPatch, customFields };
}
