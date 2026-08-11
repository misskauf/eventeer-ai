import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type LeadInput = {
  name: string;
  company: string;
  email: string;
  phone?: string;
  role?: string;
  venue_type?: string;
  current_software?: string;
  message?: string;
  consent: boolean;
  locale?: string;
  /** Honeypot — must stay empty. */
  website?: string;
};

const cap = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ROLE_KEYS = [
  "owner",
  "venue_sales_manager",
  "venue_event_manager",
  "event_manager",
  "other",
] as const;
export const VENUE_TYPE_KEYS = [
  "restaurant_cafe",
  "bar",
  "gallery_studio",
  "event_venue",
  "catering",
  "none",
] as const;
export const SOFTWARE_KEYS = ["none", "crm", "event_software", "unknown"] as const;

const pick = (v: unknown, allowed: readonly string[]) => {
  const s = cap(v, 40);
  return allowed.includes(s) ? s : null;
};

export const submitMarketingLead = createServerFn({ method: "POST" })
  .inputValidator((data: LeadInput) => data)
  .handler(async ({ data }) => {
    // Bots fill hidden fields; silently accept without storing.
    if (cap(data.website, 200)) return { ok: true as const };

    const name = cap(data.name, 120);
    const company = cap(data.company, 160);
    const email = cap(data.email, 200).toLowerCase();
    const phone = cap(data.phone, 60) || null;
    const role = pick(data.role, ROLE_KEYS);
    const venueType = pick(data.venue_type, VENUE_TYPE_KEYS);
    const currentSoftware = pick(data.current_software, SOFTWARE_KEYS);
    const message = cap(data.message, 2000) || null;
    const locale = data.locale === "de" ? "de" : "en";

    if (!name || !company || !EMAIL_RE.test(email)) throw new Error("Invalid input");
    if (!role || !venueType || !currentSoftware) throw new Error("Invalid input");
    if (data.consent !== true) throw new Error("Consent required");

    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await supabase.from("marketing_leads").insert({
      name,
      company,
      email,
      phone,
      role,
      venue_type: venueType,
      current_software: currentSoftware,
      message,
      consent: true,
      source: "landing",
      locale,
    });
    if (error) throw new Error("Could not save request");

    // Never echo submitted data back to the client.
    return { ok: true as const };
  });
