import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Safaricom's payment confirmation. This is the only place a real balance is
 * ever credited. Safaricom does not sign its callbacks, so the URL carries a
 * secret token and only a matching, successful, unpaid request is credited.
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

export const Route = createFileRoute("/api/public/mpesa-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["MPESA_CALLBACK_TOKEN"];
        const provided = new URL(request.url).searchParams.get("token");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: z.infer<typeof callbackSchema>;
        try {
          payload = callbackSchema.parse(await request.json());
        } catch {
          return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        }

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

        const { error } = await supabaseAdmin.rpc("credit_confirmed_deposit", {
          p_intent_id: intent.id,
          p_receipt: receipt,
        });
        if (error) console.error("Deposit crediting failed", intent.id, error.message);

        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
