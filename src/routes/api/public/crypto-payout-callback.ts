import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  batch_id: z.union([z.string(), z.number()]).optional(),
  payout_id: z.union([z.string(), z.number()]).optional(),
  unique_external_id: z.string().uuid().optional(),
  payout_hash: z.string().max(300).optional(),
  hash: z.string().max(300).optional(),
  status: z.string().max(60),
}).passthrough();

const hits = new Map<string, number[]>();

export const Route = createFileRoute("/api/public/crypto-payout-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const remote = request.headers.get("cf-connecting-ip") ?? "unknown";
        const now = Date.now();
        const recent = (hits.get(remote) ?? []).filter((time) => now - time < 60_000);
        if (recent.length >= 60) return new Response("Too many requests", { status: 429 });
        recent.push(now);
        hits.set(remote, recent);

        let raw: unknown;
        try { raw = await request.json(); } catch { return new Response("Invalid", { status: 400 }); }
        const { validPayoutSignature } = await import("@/lib/crypto-payout.server");
        if (!validPayoutSignature(raw, request.headers.get("x-nowpayments-sig"))) return new Response("Unauthorized", { status: 401 });
        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) return new Response("Invalid", { status: 400 });

        const value = parsed.data;
        const providerId = String(value.payout_id ?? value.id ?? value.batch_id ?? "");
        if (!value.unique_external_id && !providerId) return new Response("Invalid", { status: 400 });
        const successful = ["finished", "completed", "success"].includes(value.status.toLowerCase());
        const failed = ["failed", "rejected", "expired"].includes(value.status.toLowerCase());
        if (!successful && !failed) return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.rpc("finalize_crypto_withdrawal", {
          p_request_id: value.unique_external_id ?? "00000000-0000-0000-0000-000000000000",
          p_provider_id: providerId,
          p_success: successful,
          p_tx_hash: value.payout_hash ?? value.hash ?? "",
          p_failure_reason: failed ? "provider_rejected" : "",
        });
        if (error) console.error("Crypto withdrawal finalization failed", error.message);
        return Response.json({ ok: true });
      },
    },
  },
});
