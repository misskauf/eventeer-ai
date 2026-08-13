import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Bump this when the AGB/AVV texts change. */
export const TERMS_VERSION = "1.0-2026-08-12";
export const TERMS_DOCUMENT = "agb+avv";

/** Records that the signed-in user accepted the current AGB + AVV. */
export const recordTermsAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("terms_acceptances").insert({
      user_id: context.userId,
      terms_version: TERMS_VERSION,
      document: TERMS_DOCUMENT,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Whether the signed-in user has any acceptance on record. */
export const hasTermsAcceptance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("terms_acceptances")
      .select("id")
      .eq("user_id", context.userId)
      .limit(1);
    if (error) throw new Error(error.message);
    return { accepted: (data?.length ?? 0) > 0 };
  });
