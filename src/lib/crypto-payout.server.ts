import { createHmac } from "crypto";

const API_BASE = "https://api.nowpayments.io/v1";

export type CryptoNetwork = "btc" | "usdttrc20";

export function cryptoPayoutConfigured(): boolean {
  return Boolean(
    process.env["NOWPAYMENTS_API_KEY"] &&
      process.env["NOWPAYMENTS_EMAIL"] &&
      process.env["NOWPAYMENTS_PASSWORD"] &&
      process.env["NOWPAYMENTS_TOTP_SECRET"] &&
      process.env["NOWPAYMENTS_IPN_SECRET"],
  );
}

function config() {
  const apiKey = process.env["NOWPAYMENTS_API_KEY"];
  const email = process.env["NOWPAYMENTS_EMAIL"];
  const password = process.env["NOWPAYMENTS_PASSWORD"];
  const totpSecret = process.env["NOWPAYMENTS_TOTP_SECRET"];
  if (!apiKey || !email || !password || !totpSecret) throw new Error("crypto_payout_unavailable");
  return { apiKey, email, password, totpSecret };
}

function decodeBase32(value: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("crypto_payout_unavailable");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return new Uint8Array(bytes);
}

function totp(secret: string): string {
  const counter = Math.floor(Date.now() / 30_000);
  const message = new Uint8Array(8);
  new DataView(message.buffer).setBigUint64(0, BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 15;
  const binary = (((digest[offset] ?? 0) & 127) << 24) | ((digest[offset + 1] ?? 0) << 16) | ((digest[offset + 2] ?? 0) << 8) | (digest[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function providerFetch(path: string, init: RequestInit, apiKey: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-api-key": apiKey, ...(init.headers ?? {}) },
  });
}

export async function submitCryptoPayout(input: {
  requestId: string;
  network: CryptoNetwork;
  address: string;
  amount: number;
}): Promise<{ providerId: string }> {
  const current = config();
  const auth = await providerFetch("/auth", {
    method: "POST",
    body: JSON.stringify({ email: current.email, password: current.password }),
  }, current.apiKey);
  if (!auth.ok) throw new Error("crypto_provider_rejected");
  const authBody = (await auth.json()) as { token?: string };
  if (!authBody.token) throw new Error("crypto_provider_rejected");

  const callbackUrl = "https://cryptomagg.site/api/public/crypto-payout-callback";
  const payout = await providerFetch("/payout", {
    method: "POST",
    headers: { authorization: `Bearer ${authBody.token}` },
    body: JSON.stringify({
      withdrawals: [{
        address: input.address,
        currency: input.network,
        amount: input.amount,
        ipn_callback_url: callbackUrl,
        unique_external_id: input.requestId,
      }],
    }),
  }, current.apiKey);
  if (!payout.ok) throw new Error("crypto_provider_rejected");
  const body = (await payout.json()) as { id?: string | number; batch_id?: string | number };
  const providerId = String(body.id ?? body.batch_id ?? "");
  if (!providerId) throw new Error("crypto_provider_rejected");

  const verification = await providerFetch(`/payout/${encodeURIComponent(providerId)}/verify`, {
    method: "POST",
    headers: { authorization: `Bearer ${authBody.token}` },
    body: JSON.stringify({ verification_code: totp(current.totpSecret) }),
  }, current.apiKey);
  if (!verification.ok) throw new Error("crypto_provider_rejected");
  return { providerId };
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sorted(child)]));
  }
  return value;
}

export function validPayoutSignature(raw: unknown, signature: string | null): boolean {
  const secret = process.env["NOWPAYMENTS_IPN_SECRET"];
  if (!secret || !signature) return false;
  const expected = createHmac("sha512", secret).update(JSON.stringify(sorted(raw))).digest("hex");
  if (signature.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ signature.toLowerCase().charCodeAt(index);
  return difference === 0;
}
