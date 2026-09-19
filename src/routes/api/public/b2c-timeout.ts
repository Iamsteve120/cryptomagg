import { createFileRoute } from "@tanstack/react-router";

/**
 * Safaricom B2C queue timeout callback. The payout may still complete, so the
 * withdrawal stays pending for manual review and nothing is refunded here.
 */
export const Route = createFileRoute("/api/public/b2c-timeout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown = null;
        try {
          raw = await request.json();
        } catch {
          raw = null;
        }
        const result = (raw as { Result?: Record<string, unknown> } | null)?.Result ?? {};
        console.warn("[b2c] queue timeout callback", {
          ResultCode: result["ResultCode"],
          ResultDesc: result["ResultDesc"],
          ConversationID: result["ConversationID"],
          OriginatorConversationID: result["OriginatorConversationID"],
        });

        const { logB2cCallback } = await import("@/lib/mpesa-b2c.server");
        await logB2cCallback({
          kind: "timeout",
          resultCode: typeof result["ResultCode"] === "number" ? result["ResultCode"] : null,
          resultDesc:
            typeof result["ResultDesc"] === "string" ? result["ResultDesc"] : "Queue timeout",
          conversationId:
            typeof result["ConversationID"] === "string" ? result["ConversationID"] : null,
          originatorConversationId:
            typeof result["OriginatorConversationID"] === "string"
              ? result["OriginatorConversationID"]
              : null,
        });

        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
