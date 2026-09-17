/**
 * Safaricom Daraja (M Pesa) client. Server only.
 *
 * Nothing here runs until every credential is present, so the app can be built,
 * reviewed and tested before a paybill exists. No money can move while the
 * credentials are missing.
 */

type DarajaConfig = {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  partyB: string;
  baseUrl: string;
  callbackUrl: string;
};

/**
 * Daraja is strict about callback URL characters and length. A fixed SHA-256
 * digest keeps the callback path URL-safe without exposing the stored token.
 */
export async function callbackTokenDigest(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readDarajaConfig(): DarajaConfig | null {
  // Credentials are often pasted with stray spaces or lookalike letters from a
  // rich text editor; keep only the plain characters Daraja keys are made of.
  const clean = (value: string | undefined) =>
    value ? value.trim().replace(/[^\x21-\x7e]/g, "") : value;
  const consumerKey = clean(process.env["CONSUMER_KEY"] ?? process.env["MPESA_CONSUMER_KEY"]);
  const consumerSecret = clean(
    process.env["CONSUMER_SECRET"] ?? process.env["MPESA_CONSUMER_SECRET"],
  );
  const shortcode = process.env["LNM_SHORTCODE"] ?? process.env["MPESA_SHORTCODE"];
  const passkey = process.env["MPESA_PASSKEY"];
  const callbackBase = process.env["MPESA_CALLBACK_URL"];
  const callbackToken = process.env["MPESA_CALLBACK_TOKEN"];
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackBase || !callbackToken) {
    return null;
  }
  // The confirmation URL carries its own secret token, since Safaricom does not
  // sign callbacks. Daraja rejects URLs with a query string, so the token is a
  // path segment. Assembled here so the token is never stored in a URL.
  const callbackBasePath = (callbackBase.split("?")[0] ?? callbackBase).replace(/\/+$/, "");
  // The final path segment is added in sendStkPush after hashing the secret.
  // Keeping it out of this synchronous config reader also avoids punctuation
  // or excessive token length making Daraja reject an otherwise valid URL.
  const callbackUrl = callbackBasePath;

  const live = process.env["MPESA_ENV"] === "production";
  return {
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    partyB: process.env["PARTY_B"] ?? shortcode,
    callbackUrl,
    baseUrl: live ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
  };
}

/**
 * True while the app talks to the Safaricom test system. Nothing here charges a
 * real phone: prompts come from the sandbox and use Safaricom test numbers.
 */
export function sandboxMode(): boolean {
  return (process.env["MPESA_ENV"] ?? "sandbox").trim().toLowerCase() !== "production";
}

/** True only when real money is allowed to move. Absent env means off. */
export function realMoneyEnabled(): boolean {
  const flag = (process.env["REAL_MONEY_ENABLED"] ?? "").trim().toLowerCase();
  const on = flag === "true" || flag === "1" || flag === "yes" || flag === "on";
  return on && readDarajaConfig() !== null;
}

async function accessToken(config: DarajaConfig): Promise<string> {
  const basic = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(
    `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${basic}` } },
  );
  if (!response.ok) {
    // Daraja rejects the app credentials themselves here (wrong key/secret, or an
    // app that is not live). Log the status so the cause is visible in the logs.
    const detail = await response.text().catch(() => "");
    console.error("M Pesa auth rejected", response.status, detail.slice(0, 200));
    throw new Error("mpesa_auth_failed");
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("mpesa_auth_failed");
  return body.access_token;
}

/**
 * Probes the live Daraja OAuth login and returns a short status string for
 * diagnostics. Never throws — used by the read-only account status endpoint.
 * Does not move any money or send an STK push.
 */
export async function probeLiveAuth(config: DarajaConfig): Promise<string> {
  try {
    await accessToken(config);
    return "auth_ok";
  } catch (error) {
    return error instanceof Error && error.message === "mpesa_auth_failed"
      ? "auth_rejected"
      : "auth_unreachable";
  }
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    String(now.getUTCFullYear()) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds())
  );
}

/**
 * Sends the PIN prompt to the trader's phone. Returns the Daraja checkout id so
 * the confirmation callback can be matched back to the deposit request.
 */
export async function sendStkPush(input: {
  phone: string;
  amountKes: number;
  reference: string;
  description: string;
}): Promise<{ checkoutRequestId: string }> {
  const config = readDarajaConfig();
  if (!config) throw new Error("mpesa_not_configured");

  const token = await accessToken(config);
  const stamp = timestamp();
  const password = Buffer.from(config.shortcode + config.passkey + stamp).toString("base64");
  const callbackToken = process.env["MPESA_CALLBACK_TOKEN"];
  if (!callbackToken) throw new Error("mpesa_not_configured");
  const callbackUrl = `${config.callbackUrl}/${await callbackTokenDigest(callbackToken)}`;

  const response = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: stamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.max(1, Math.round(input.amountKes)),
      PartyA: input.phone,
      PartyB: config.partyB,
      PhoneNumber: input.phone,
      CallBackURL: callbackUrl,
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 20),
    }),
  });

  const body = (await response.json()) as {
    CheckoutRequestID?: string;
    errorCode?: string;
    errorMessage?: string;
    ResponseCode?: string;
  };
  if (!response.ok || !body.CheckoutRequestID || body.ResponseCode !== "0") {
    console.error("STK push rejected", body.errorMessage ?? body.ResponseCode ?? response.status);
    if (body.errorMessage?.toLowerCase().includes("callbackurl")) {
      throw new Error("mpesa_callback_rejected");
    }
    throw new Error(body.errorCode === "400.002.02" ? "mpesa_request_rejected" : "mpesa_push_failed");
  }
  return { checkoutRequestId: body.CheckoutRequestID };
}

/** Pays a trader out to M Pesa. Requires the B2C initiator credentials. */
export async function sendB2cPayout(input: {
  phone: string;
  amountKes: number;
  remarks: string;
  resultUrl: string;
}): Promise<{ conversationId: string }> {
  const config = readDarajaConfig();
  const initiator = process.env["MPESA_INITIATOR_NAME"];
  const securityCredential = process.env["MPESA_SECURITY_CREDENTIAL"];
  if (!config || !initiator || !securityCredential) throw new Error("mpesa_payout_not_configured");

  const token = await accessToken(config);
  const response = await fetch(`${config.baseUrl}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      OriginatorConversationID: crypto.randomUUID(),
      InitiatorName: initiator,
      SecurityCredential: securityCredential,
      CommandID: "BusinessPayment",
      Amount: Math.max(1, Math.round(input.amountKes)),
      PartyA: config.shortcode,
      PartyB: input.phone,
      Remarks: input.remarks.slice(0, 100),
      QueueTimeOutURL: input.resultUrl,
      ResultURL: input.resultUrl,
      Occasion: "Withdrawal",
    }),
  });

  const body = (await response.json()) as { ConversationID?: string; errorMessage?: string };
  if (!response.ok || !body.ConversationID) {
    console.error("B2C payout rejected", body.errorMessage ?? response.status);
    throw new Error("mpesa_payout_failed");
  }
  return { conversationId: body.ConversationID };
}
