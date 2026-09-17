import { createFileRoute } from "@tanstack/react-router";

/**
 * Read-only Daraja configuration probe. Returns only *lengths* and a live OAuth
 * result — never the credential values themselves. Used to diagnose why an STK
 * push fails without moving any money. Gated by the callback token so it is not
 * publicly enumerable.
 */

export const Route = createFileRoute("/api/public/daraja-diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env["MPESA_CALLBACK_TOKEN"];
        const provided = new URL(request.url).searchParams.get("token");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { readDarajaConfig, realMoneyEnabled, sandboxMode, probeLiveAuth } = await import(
          "@/lib/mpesa.server"
        );

        const config = readDarajaConfig();
        const envLengths = {
          consumerKeyLength: (
            process.env["CONSUMER_KEY"] ?? process.env["MPESA_CONSUMER_KEY"] ?? ""
          ).length,
          consumerSecretLength: (
            process.env["CONSUMER_SECRET"] ?? process.env["MPESA_CONSUMER_SECRET"] ?? ""
          ).length,
          passkeyLength: (process.env["MPESA_PASSKEY"] ?? "").length,
          shortcode: process.env["LNM_SHORTCODE"] ?? process.env["MPESA_SHORTCODE"] ?? "",
          partyB: process.env["PARTY_B"] ?? "",
          callbackUrl: process.env["MPESA_CALLBACK_URL"] ?? "",
        };

        if (!config) {
          return Response.json({
            enabled: realMoneyEnabled(),
            sandbox: sandboxMode(),
            configured: false,
            ...envLengths,
            authProbe: "missing_config",
          });
        }

        return Response.json({
          enabled: realMoneyEnabled(),
          sandbox: sandboxMode(),
          configured: true,
          consumerKeyLength: config.consumerKey.length,
          consumerSecretLength: config.consumerSecret.length,
          passkeyLength: config.passkey.length,
          shortcode: config.shortcode,
          partyB: config.partyB,
          callbackUrlHost: config.callbackUrl.split("/")[2] ?? config.callbackUrl,
          authProbe: await probeLiveAuth(config),
        });
      },
    },
  },
});
