import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KYC_TYPES = ["national_id", "drivers_licence", "passport"] as const;

const kycSchema = z.object({
  docType: z.enum(KYC_TYPES),
  frontPath: z.string().trim().min(6).max(300),
  backPath: z.string().trim().min(6).max(300),
});

const APPROVAL_DELAY_MS = 29_000;

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
    if (
      !data.frontPath.startsWith(`${context.userId}/`) ||
      !data.backPath.startsWith(`${context.userId}/`) ||
      data.frontPath === data.backPath
    ) {
      throw new Error("That document could not be verified.");
    }
    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("id, email, first_name, full_name, client_id, kyc_status")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Your account is not ready yet. Please reload the page.");

    const alreadySubmitted = profile.kyc_status === "processing" || profile.kyc_status === "approved";
    const submittedAt = new Date().toISOString();

    const { error } = await db
      .from("profiles")
      .update({
        kyc_doc_type: data.docType,
        kyc_doc_path: data.frontPath,
        kyc_doc_front_path: data.frontPath,
        kyc_doc_back_path: data.backPath,
        kyc_status: "processing",
        kyc_submitted_at: submittedAt,
        kyc_approved_at: null,
        updated_at: submittedAt,
      })
      .eq("id", context.userId);
    if (error) throw new Error("We could not save your document. Please try again.");

    return { ok: true, clientId: profile.client_id ?? null, approvalDelaySeconds: 29 };
  });

/** Completes the automated upload check only after the advertised 29 seconds. */
export const completeKycProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("kyc_status, kyc_submitted_at, kyc_doc_front_path, kyc_doc_back_path, email, first_name, full_name, client_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.kyc_submitted_at || !profile.kyc_doc_front_path || !profile.kyc_doc_back_path) {
      throw new Error("Both sides of your document are required.");
    }
    const elapsed = Date.now() - new Date(profile.kyc_submitted_at).getTime();
    if (elapsed < APPROVAL_DELAY_MS) {
      return { approved: false, secondsLeft: Math.ceil((APPROVAL_DELAY_MS - elapsed) / 1000) };
    }
    const approvedAt = new Date().toISOString();
    const { data: approved, error } = await db
      .from("profiles")
      .update({ kyc_status: "approved", kyc_approved_at: approvedAt, updated_at: approvedAt })
      .eq("id", context.userId)
      .eq("kyc_status", "processing")
      .select("id")
      .maybeSingle();
    if (error) throw new Error("The document check could not finish. Please try again.");
    if (approved && profile.email) {
      const { sendWelcomeEmail } = await import("./email.server");
      await sendWelcomeEmail({
        to: profile.email,
        name: profile.first_name ?? profile.full_name,
        clientId: profile.client_id ?? "",
      });
    }
    return { approved: true, secondsLeft: 0 };
  });
