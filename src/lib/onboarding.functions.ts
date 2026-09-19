import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KYC_TYPES = ["national_id", "drivers_licence", "passport"] as const;

const kycSchema = z.object({
  docType: z.enum(KYC_TYPES),
  storagePath: z.string().trim().min(6).max(300),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Records that the signed-in client is active, for the admin activity KPIs. */
export const recordActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind?: string } | undefined) => ({
    kind: input?.kind === "signin" ? "signin" : "heartbeat",
  }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const now = new Date().toISOString();
    await db.from("profiles").update({ last_seen_at: now }).eq("id", context.userId);
    if (data.kind === "signin") {
      await db.from("login_events").insert({ user_id: context.userId, kind: "signin" });
    }
    return { ok: true };
  });

/**
 * Stores the identity document the client just uploaded, marks verification as
 * submitted and sends the welcome email. The file itself stays in the private
 * store; only the owner and admins can read it.
 */
export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => kycSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.storagePath.startsWith(`${context.userId}/`)) {
      throw new Error("That document could not be verified.");
    }
    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("id, email, first_name, full_name, client_id, kyc_status")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Your account is not ready yet. Please reload the page.");

    const alreadySubmitted = profile.kyc_status === "submitted" || profile.kyc_status === "approved";

    const { error } = await db
      .from("profiles")
      .update({
        kyc_doc_type: data.docType,
        kyc_doc_path: data.storagePath,
        kyc_status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw new Error("We could not save your document. Please try again.");

    if (!alreadySubmitted && profile.email) {
      const { sendWelcomeEmail } = await import("./email.server");
      await sendWelcomeEmail({
        to: profile.email,
        name: profile.first_name ?? profile.full_name,
        clientId: profile.client_id ?? "",
      });
    }

    return { ok: true, clientId: profile.client_id ?? null };
  });
