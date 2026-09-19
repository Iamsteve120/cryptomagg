import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Safaricom B2C result callback. Called by Safaricom, so no session and no
 * CSRF token exists. Settlement is idempotent: a withdrawal that is already
 * finalised is ignored. Always answers HTTP 200 so Safaricom stops retrying.
 */

const resultSchema = z.object({
  Result: z.object({
    ResultCode: z.coerce.number(),
    ResultDesc: z.string().max(400).optional(),
    ConversationID: z.string().max(160).optional(),
    OriginatorConversationID: z.string().max(160).optional(),
    TransactionID: z.string().max(160).optional(),
    ResultParameters: z
      .object({
        ResultParameter: z.array(
          z.object({
            Key: z.string(),
            Value: z.union([z.string(), z.number()]).optional(),
          }),
        ),
      })
      .optional(),
  }),
});

const ACCEPTED = { ResultCode: 0, ResultDesc: "Accepted" };

export const Route = createFileRoute("/api/public/b2c-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json(ACCEPTED);
        }

        const parsed = resultSchema.safeParse(raw);
        if (!parsed.success) {
          console.warn("[b2c] unrecognised result callback shape");
          return Response.json(ACCEPTED);
        }

        const result = parsed.data.Result;
        const params = result.ResultParameters?.ResultParameter ?? [];
        const param = (key: string) =>
          params.find((p) => p.Key.toLowerCase() === key.toLowerCase())?.Value;
        const receipt = String(result.TransactionID ?? param("TransactionReceipt") ?? "");
        const receiverName = String(param("ReceiverPartyPublicName") ?? "");
        const success = result.ResultCode === 0;

        console.info("[b2c] result callback", {
          ResultCode: result.ResultCode,
          ResultDesc: result.ResultDesc,
          ConversationID: result.ConversationID,
          OriginatorConversationID: result.OriginatorConversationID,
        });

        const b2c = await import("@/lib/mpesa-b2c.server");
        await b2c.logB2cCallback({
          kind: "result",
          resultCode: result.ResultCode,
          resultDesc: result.ResultDesc ?? null,
          conversationId: result.ConversationID ?? null,
          originatorConversationId: result.OriginatorConversationID ?? null,
          receipt: receipt || null,
        });

        // 2001 and 8006 mean the operator credentials are wrong. Repeating the
        // call locks the operator, so all payouts stop until an admin clears it.
        if (result.ResultCode === 2001 || result.ResultCode === 8006) {
          await b2c.setB2cBlock(
            String(result.ResultCode),
            result.ResultDesc ?? "Initiator information rejected",
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settled, error } = await supabaseAdmin.rpc("finalize_b2c_withdrawal", {
          p_originator_conversation_id: result.OriginatorConversationID ?? "",
          p_conversation_id: result.ConversationID ?? "",
          p_success: success,
          ...(receipt ? { p_receipt: receipt } : {}),
          p_result_code: result.ResultCode,
          ...(result.ResultDesc ? { p_result_desc: result.ResultDesc } : {}),
          ...(receiverName ? { p_receiver_name: receiverName } : {}),
        });
        if (error) {
          console.error("[b2c] settlement failed", error.message);
          return Response.json(ACCEPTED);
        }

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
            console.error("[b2c] result email failed", mailError);
          }
        }

        return Response.json(ACCEPTED);
      },
    },
  },
});
