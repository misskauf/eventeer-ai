export type LeadFieldKey =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "event_type"
  | "event_date"
  | "guest_count"
  | "message";

export type LeadFieldConfig = { enabled: boolean; required: boolean };
export type LeadFieldsConfig = Record<LeadFieldKey, LeadFieldConfig>;

export const LEAD_FIELDS: { key: LeadFieldKey; label: string; type: "text" | "email" | "tel" | "date" | "number" | "textarea" }[] = [
  { key: "name", label: "Full name", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "company", label: "Company", type: "text" },
  { key: "event_type", label: "Event type", type: "text" },
  { key: "event_date", label: "Event date", type: "date" },
  { key: "guest_count", label: "Guest count", type: "number" },
  { key: "message", label: "Message", type: "textarea" },
];

export const DEFAULT_FIELDS: LeadFieldsConfig = {
  name: { enabled: true, required: true },
  email: { enabled: true, required: true },
  phone: { enabled: true, required: false },
  company: { enabled: true, required: false },
  event_type: { enabled: true, required: false },
  event_date: { enabled: true, required: false },
  guest_count: { enabled: true, required: false },
  message: { enabled: true, required: false },
};

export function normalizeFields(input: unknown): LeadFieldsConfig {
  const out = { ...DEFAULT_FIELDS };
  if (input && typeof input === "object") {
    for (const key of Object.keys(DEFAULT_FIELDS) as LeadFieldKey[]) {
      const v = (input as any)[key];
      if (v && typeof v === "object") {
        out[key] = {
          enabled: v.enabled !== false,
          required: !!v.required,
        };
      }
    }
  }
  return out;
}
