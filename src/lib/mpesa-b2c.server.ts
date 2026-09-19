/**
 * Safaricom Daraja B2C (payout) client. Server only.
 *
 * Every secret is read from the server environment at call time and never
 * returned to the browser or written to a log. The SecurityCredential is
 * generated fresh on each request by encrypting the raw initiator password
 * with Safaricom's production certificate; nothing is cached or compared.
 */

import {
  constants,
  createPublicKey,
  publicEncrypt,
  X509Certificate,
  type KeyObject,
} from "node:crypto";

const PRODUCTION_BASE_URL = "https://api.safaricom.co.ke";

/** Callback URLs always use the custom domain, never a preview host. */
export const B2C_RESULT_URL = "https://cryptomagg.site/api/public/b2c-result";
export const B2C_TIMEOUT_URL = "https://cryptomagg.site/api/public/b2c-timeout";

type B2cConfig = {
  initiatorName: string;
  initiatorPassword: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  certPem: string;
  commandId: string;
};

function clean(value: string | undefined): string {
  return value ? value.trim().replace(/[^\x20-\x7e]/g, "") : "";
}

function normalisePem(value: string | undefined): string {
  if (!value) return "";
  // Secret stores often collapse newlines; restore them so Node can parse it.
  const raw = value.trim().replace(/\\n/g, "\n");
  if (raw.includes("-----BEGIN")) return raw;
  const body = raw.replace(/\s+/g, "");
  if (!body) return "";
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----\n`;
}

export function readB2cConfig(): B2cConfig | null {
  const initiatorName = clean(process.env["MPESA_INITIATOR_NAME"]);
  const initiatorPassword = (process.env["MPESA_INITIATOR_PASSWORD"] ?? "").trim();
  const consumerKey = clean(process.env["MPESA_B2C_CONSUMER_KEY"]);
  const consumerSecret = clean(process.env["MPESA_B2C_CONSUMER_SECRET"]);
  const shortcode = clean(process.env["MPESA_B2C_SHORTCODE"]);
  const certPem = normalisePem(process.env["MPESA_CERT_PEM"]);
  const commandId = clean(process.env["MPESA_B2C_COMMAND_ID"]) || "BusinessPayment";
  if (
    !initiatorName ||
    !initiatorPassword ||
    !consumerKey ||
    !consumerSecret ||
    !shortcode ||
    !certPem
  ) {
    return null;
  }
  return {
    initiatorName,
    initiatorPassword,
    consumerKey,
    consumerSecret,
    shortcode,
    certPem,
    commandId,
  };
}

/** True only when every payout secret is present. */
export function b2cConfigured(): boolean {
  return readB2cConfig() !== null;
}

/** Names the missing payout secrets for the admin screen. Values are never read out. */
export function missingB2cSecrets(): string[] {
  const required = [
    "MPESA_INITIATOR_NAME",
    "MPESA_INITIATOR_PASSWORD",
    "MPESA_B2C_CONSUMER_KEY",
    "MPESA_B2C_CONSUMER_SECRET",
    "MPESA_B2C_SHORTCODE",
    "MPESA_CERT_PEM",
  ];
  return required.filter((name) => !(process.env[name] ?? "").trim());
}

/** Generated per request. Never cached, never logged, never compared. */
function securityCredential(config: B2cConfig): string {
  let key: KeyObject;
  try {
    key = new X509Certificate(config.certPem).publicKey;
  } catch {
    key = createPublicKey(config.certPem);
  }
  // The worker runtime's publicEncrypt only accepts PEM/Buffer keys, not KeyObject.
  const publicKeyPem = key.export({ type: "spki", format: "pem" }) as string;
  return publicEncrypt(
    { key: publicKeyPem, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(config.initiatorPassword, "utf8"),
  ).toString("base64");
}


type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;
const TOKEN_TTL_MS = 50 * 60_000;

async function accessToken(config: B2cConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const basic = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(`${PRODUCTION_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!response.ok) {
    console.error("[b2c] token request rejected", response.status);
    throw new Error("mpesa_payout_auth_failed");
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("mpesa_payout_auth_failed");
  tokenCache = { token: body.access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return body.access_token;
}

/** Strips every credential-bearing field before anything is written to a log. */
function redact(payload: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...payload };
  for (const field of ["SecurityCredential", "Password", "access_token", "token"]) {
    if (field in copy) copy[field] = "[redacted]";
  }
  return copy;
}

export type B2cSubmission =
  | { queued: true; conversationId: string; originatorConversationId: string }
  | { queued: false; code: string; description: string };

/**
 * Queues a payout with Safaricom. A "0" response code only means queued:
 * the money is not paid until the result callback confirms ResultCode 0.
 */
export async function submitB2cPayout(input: {
  phone: string;
  amountKes: number;
  originatorConversationId: string;
  remarks?: string;
}): Promise<B2cSubmission> {
  const config = readB2cConfig();
  if (!config) throw new Error("mpesa_payout_not_configured");

  const amount = Math.max(1, Math.round(input.amountKes));
  const payload = {
    OriginatorConversationID: input.originatorConversationId,
    InitiatorName: config.initiatorName,
    SecurityCredential: securityCredential(config),
    CommandID: config.commandId,
    Amount: amount,
    PartyA: config.shortcode,
    PartyB: input.phone,
    Remarks: (input.remarks ?? "Withdrawal").slice(0, 100),
    QueueTimeOutURL: B2C_TIMEOUT_URL,
    ResultURL: B2C_RESULT_URL,
    Occasion: "",
  };
  console.info("[b2c] payout request", redact(payload));

  const token = await accessToken(config);
  const response = await fetch(`${PRODUCTION_BASE_URL}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as {
    ConversationID?: string;
    OriginatorConversationID?: string;
    ResponseCode?: string;
    ResponseDescription?: string;
    errorCode?: string;
    errorMessage?: string;
  };
  console.info("[b2c] payout response", response.status, redact(body as Record<string, unknown>));

  if (!response.ok || body.ResponseCode !== "0" || !body.ConversationID) {
    return {
      queued: false,
      code: String(body.errorCode ?? body.ResponseCode ?? response.status),
      description: String(body.errorMessage ?? body.ResponseDescription ?? "Request rejected"),
    };
  }
  return {
    queued: true,
    conversationId: body.ConversationID,
    originatorConversationId: body.OriginatorConversationID ?? input.originatorConversationId,
  };
}

/**
 * Credential health check that moves no money: asks Safaricom for the
 * shortcode's own balance using the same initiator and credential.
 */
export async function queryAccountBalance(): Promise<{
  accepted: boolean;
  code: string;
  description: string;
}> {
  const config = readB2cConfig();
  if (!config) return { accepted: false, code: "not_configured", description: "Payout secrets are incomplete." };

  const payload = {
    Initiator: config.initiatorName,
    SecurityCredential: securityCredential(config),
    CommandID: "AccountBalance",
    PartyA: config.shortcode,
    IdentifierType: "4",
    Remarks: "Credential check",
    QueueTimeOutURL: B2C_TIMEOUT_URL,
    ResultURL: B2C_RESULT_URL,
  };
  console.info("[b2c] balance request", redact(payload));

  try {
    const token = await accessToken(config);
    const response = await fetch(`${PRODUCTION_BASE_URL}/mpesa/accountbalance/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as {
      ResponseCode?: string;
      ResponseDescription?: string;
      errorCode?: string;
      errorMessage?: string;
    };
    console.info("[b2c] balance response", response.status, redact(body as Record<string, unknown>));
    return {
      accepted: response.ok && body.ResponseCode === "0",
      code: String(body.errorCode ?? body.ResponseCode ?? response.status),
      description: String(body.errorMessage ?? body.ResponseDescription ?? "No description"),
    };
  } catch (error) {
    console.error("[b2c] balance check failed", error instanceof Error ? error.message : "unknown");
    return { accepted: false, code: "unreachable", description: "Safaricom could not be reached." };
  }
}

/* ---------------------------------------------------------------- block flag */

const BLOCK_FLAG = "b2c_blocked";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readB2cBlock(): Promise<{
  blocked: boolean;
  code: string | null;
  detail: string | null;
  since: string | null;
}> {
  const db = await admin();
  const { data } = await db
    .from("platform_flags")
    .select("enabled, code, detail, updated_at")
    .eq("flag", BLOCK_FLAG)
    .maybeSingle();
  return {
    blocked: Boolean(data?.enabled),
    code: data?.code ?? null,
    detail: data?.detail ?? null,
    since: data?.updated_at ?? null,
  };
}

/** Set after ResultCode 2001 or 8006. Repeated 2001 locks the operator, so never retry. */
export async function setB2cBlock(code: string, detail: string): Promise<void> {
  const db = await admin();
  await db.from("platform_flags").upsert(
    {
      flag: BLOCK_FLAG,
      enabled: true,
      code: code.slice(0, 40),
      detail: detail.slice(0, 300),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "flag" },
  );
}

/** Only an admin action clears the block. */
export async function clearB2cBlock(): Promise<void> {
  const db = await admin();
  await db.from("platform_flags").upsert(
    { flag: BLOCK_FLAG, enabled: false, code: null, detail: null, updated_at: new Date().toISOString() },
    { onConflict: "flag" },
  );
}

export async function logB2cCallback(input: {
  kind: string;
  resultCode?: number | null;
  resultDesc?: string | null;
  conversationId?: string | null;
  originatorConversationId?: string | null;
  receipt?: string | null;
}): Promise<void> {
  try {
    const db = await admin();
    await db.from("b2c_callback_events").insert({
      kind: input.kind.slice(0, 40),
      result_code: input.resultCode ?? null,
      result_desc: (input.resultDesc ?? "").slice(0, 300) || null,
      conversation_id: input.conversationId ?? null,
      originator_conversation_id: input.originatorConversationId ?? null,
      transaction_receipt: input.receipt ?? null,
    });
  } catch (error) {
    console.error("[b2c] callback log failed", error instanceof Error ? error.message : "unknown");
  }
}
