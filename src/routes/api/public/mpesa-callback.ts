import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Safaricom's payment confirmation. This is the only place a real balance is
 * ever credited. Safaricom does not sign its callbacks, so each successful
 * callback is confirmed through Daraja before funds are credited.
 */

const callbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      CheckoutRequestID: z.string().min(1).max(120),
      ResultCode: z.number(),
      ResultDesc: z.string().max(400).optional(),
      CallbackMetadata: z
        .object({
          Item: z.array(
            z.object({
              Name: z.string(),
              Value: z.union([z.string(), z.number()]).optional(),
            }),
          ),
        })
        .optional(),
    }),
  }),
});

const b2cCallbackSchema = z.object({
  Result: z.object({
    ResultCode: z.number(),
    ResultDesc: z.string().max(400).optional(),
    ConversationID: z.string().min(1).max(160),
    TransactionID: z.string().max(160).optional(),
  }),
});

export const Route = createFileRoute("/api/public/mpesa-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        }

        const b2cPayload = b2cCallbackSchema.safeParse(raw);
        if (b2cPayload.success) {
          const result = b2cPayload.data.Result;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const settlementInput: {
            p_conversation_id: string;
            p_success: boolean;
            p_receipt?: string;
            p_failure_reason?: string;
          } = {
            p_conversation_id: result.ConversationID,
            p_success: result.ResultCode === 0,
          };
          if (result.TransactionID) settlementInput.p_receipt = result.TransactionID;
          if (result.ResultDesc) settlementInput.p_failure_reason = result.ResultDesc;
          const { data: settled, error } = await supabaseAdmin.rpc(
            "finalize_mpesa_withdrawal",
            settlementInput,
          );
          if (error) {
            console.error("Withdrawal finalization failed", error.message);
          } else {
            const withdrawal = settled?.[0];
            if (withdrawal) {
              try {
                const { data: owner } = await supabaseAdmin
                  .from("profiles")
                  .select("email, full_name")
                  .eq("id", withdrawal.user_id)
                  .maybeSingle();
                if (owner?.email) {
                  const { sendWithdrawalReceipt } = await import("@/lib/email.server");
                  await sendWithdrawalReceipt({
                    to: owner.email,
                    name: owner.full_name,
                    amountUsdt: Number(withdrawal.amount_usdt),
                    phone: withdrawal.phone,
                    status: withdrawal.final_status === "completed" ? "completed" : "failed",
                  });
                }
              } catch (mailError) {
                console.error("Withdrawal result email failed", mailError);
              }
            }
          }
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        const parsed = callbackSchema.safeParse(raw);
        if (!parsed.success) return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        const payload = parsed.data;

        const callback = payload.Body.stkCallback;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: intent } = await supabaseAdmin
          .from("deposit_intents")
          .select("id, amount_kes, status")
          .eq("provider_checkout_id", callback.CheckoutRequestID)
          .maybeSingle();

        if (!intent) return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });

        if (callback.ResultCode !== 0) {
          await supabaseAdmin
            .from("deposit_intents")
            .update({
              status: "failed",
              failure_reason: (callback.ResultDesc ?? "declined").slice(0, 200),
              updated_at: new Date().toISOString(),
            })
            .eq("id", intent.id)
            .eq("status", "awaiting_user");
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        const { verifyStkPayment } = await import("@/lib/mpesa.server");
        if (!(await verifyStkPayment(callback.CheckoutRequestID))) {
          console.error("M Pesa callback could not be verified", callback.CheckoutRequestID);
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        const items = callback.CallbackMetadata?.Item ?? [];
        const paidAmount = Number(items.find((i) => i.Name === "Amount")?.Value ?? NaN);
        const receipt = String(items.find((i) => i.Name === "MpesaReceiptNumber")?.Value ?? "");

        // Credit only what Safaricom confirms was actually paid.
        if (!receipt || !Number.isFinite(paidAmount) || paidAmount < Number(intent.amount_kes)) {
          await supabaseAdmin
            .from("deposit_intents")
            .update({
              status: "failed",
              failure_reason: "amount_mismatch",
              updated_at: new Date().toISOString(),
            })
            .eq("id", intent.id)
            .eq("status", "awaiting_user");
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        const { data: newBalance, error } = await supabaseAdmin.rpc("credit_confirmed_deposit", {
          p_intent_id: intent.id,
          p_receipt: receipt,
        });
        if (error) {
          console.error("Deposit crediting failed", intent.id, error.message);
        } else {
          // Confirmation email. Never allowed to affect the payment result.
          try {
            const { data: owner } = await supabaseAdmin
              .from("deposit_intents")
              .select("amount_usdt, amount_kes, profiles:user_id (email, full_name)")
              .eq("id", intent.id)
              .maybeSingle<{
                amount_usdt: number;
                amount_kes: number;
                profiles: { email: string | null; full_name: string | null } | null;
              }>();
            if (owner?.profiles?.email) {
              const { sendDepositReceipt } = await import("@/lib/email.server");
              await sendDepositReceipt({
                to: owner.profiles.email,
                name: owner.profiles.full_name,
                amountUsdt: Number(owner.amount_usdt),
                amountKes: Number(owner.amount_kes),
                receipt,
                balanceUsdt: Number(newBalance ?? 0),
              });
            }
          } catch (mailError) {
            console.error("Deposit email failed", mailError);
          }
        }

        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
