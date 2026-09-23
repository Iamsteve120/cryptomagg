import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CRYPTO_MIN_WITHDRAWAL,
  LIVE_MAX_DEPOSIT,
  LIVE_MIN_DEPOSIT,
  LIVE_MIN_WITHDRAWAL,
  normaliseKenyanPhone,
} from "./live-trading";

const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimit(userId: string, bucket: string, maximum: number) {
  const key = userId + ":" + bucket;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= maximum) throw new Error("Too many requests. Please wait a moment.");
  recent.push(now);
  hits.set(key, recent);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Traders must place at least two real trades before any payout is allowed. */
const MIN_TRADES_BEFORE_WITHDRAWAL = 2;

async function requireTradingActivity(userId: string): Promise<void> {
  const db = await admin();
  const { count, error } = await db
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("account_mode", "live");
  if (error) throw new Error("Could not check your account. Please try again.");
  if ((count ?? 0) < MIN_TRADES_BEFORE_WITHDRAWAL) {
    const left = MIN_TRADES_BEFORE_WITHDRAWAL - (count ?? 0);
    throw new Error(
      `Place ${left} more real trade${left === 1 ? "" : "s"} before you can withdraw. At least ${MIN_TRADES_BEFORE_WITHDRAWAL} trades are required.`,
    );
  }
}

async function usdKesRate(): Promise<number | null> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { rates?: { KES?: number } };
    const rate = Number(payload.rates?.KES);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/**
 * Tells the signed-in trader whether real money can move yet.
 * Requires authentication and returns no provider configuration or credential
 * details, and performs no outbound provider authentication probe.
 */
export const getLiveAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    rateLimit(context.userId, "live-status", 30);
    const { realMoneyEnabled, readDarajaConfig, sandboxMode } = await import("./mpesa.server");
    return {
      enabled: realMoneyEnabled(),
      providerConfigured: readDarajaConfig() !== null,
      cryptoPayoutConfigured: (await import("./crypto-payout.server")).cryptoPayoutConfigured(),
      sandbox: sandboxMode(),
    };
  });


const depositSchema = z.object({
  amountUsdt: z.number().positive().max(LIVE_MAX_DEPOSIT),
  phone: z.string().trim().min(9).max(20),
});

/**
 * Starts an M Pesa deposit: records the request, then asks Safaricom to send the
 * PIN prompt. The balance is credited only by the signed confirmation callback.
 */
export const startMpesaDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => depositSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "deposit", 5);

    const { realMoneyEnabled, sendStkPush } = await import("./mpesa.server");
    if (!realMoneyEnabled()) {
      throw new Error(
        "Real deposits are not switched on yet. No money is collected and no balance is credited.",
      );
    }

    const phone = normaliseKenyanPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Safaricom number, for example 0712345678.");

    const amountUsdt = Math.round(data.amountUsdt * 100) / 100;
    if (amountUsdt < LIVE_MIN_DEPOSIT) {
      throw new Error(`The smallest deposit is ${LIVE_MIN_DEPOSIT} USDT.`);
    }

    const rate = await usdKesRate();
    if (rate === null) throw new Error("The shilling rate is unavailable. Please try again shortly.");
    const amountKes = Math.round(amountUsdt * rate);

    const db = await admin();
    const { data: intent, error } = await db
      .from("deposit_intents")
      .insert({
        user_id: context.userId,
        amount_usdt: amountUsdt,
        amount_kes: amountKes,
        usd_kes_rate: rate,
        phone,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !intent) throw new Error("Could not start the deposit. Please try again.");

    try {
      const push = await sendStkPush({
        phone,
        amountKes,
        reference: "CMAGG",
        description: "Account top up",
      });
      await db
        .from("deposit_intents")
        .update({
          status: "awaiting_user",
          provider_checkout_id: push.checkoutRequestId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", intent.id);
      return { ok: true as const, id: intent.id, amountUsdt, amountKes, phone };
    } catch (pushError) {
      console.error("STK push failed", pushError);
      await db
        .from("deposit_intents")
        .update({
          status: "failed",
          failure_reason: "provider_error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", intent.id);
      const reason = pushError instanceof Error ? pushError.message : "";
      if (reason === "mpesa_auth_failed") {
        return {
          ok: false as const,
          error: "M Pesa rejected the app login. Deposits are paused until the M Pesa keys are corrected.",
        };
      }
      if (reason === "mpesa_callback_rejected") {
        return {
          ok: false as const,
          error: "M Pesa rejected the payment confirmation address. Please try again after the app update.",
        };
      }
      if (reason === "mpesa_request_rejected") {
        return {
          ok: false as const,
          error: "M Pesa rejected the deposit details. Please confirm the paybill and passkey are from the same production app.",
        };
      }
      return { ok: false as const, error: "M Pesa could not be reached. Please try again in a moment." };
    }
  });

const withdrawalSchema = z.object({
  amountUsdt: z.number().positive().max(100_000),
  phone: z.string().trim().min(9).max(20),
  code: z.string().trim().min(4).max(12),
});

const OTP_TTL_MS = 60_000;
const OTP_MAX_ATTEMPTS = 3;

async function hashCode(code: string) {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

const otpRequestSchema = z.object({
  amountUsdt: z.number().positive().max(100_000),
  phone: z.string().trim().min(9).max(20),
});

const cryptoNetworkSchema = z.enum(["btc", "usdttrc20"]);
const cryptoAddressSchema = z.object({
  amountUsdt: z.number().positive().max(100_000),
  network: cryptoNetworkSchema,
  address: z.string().trim().min(25).max(120),
});
const cryptoWithdrawalSchema = cryptoAddressSchema.extend({ code: z.string().trim().min(4).max(12) });

function validCryptoAddress(network: "btc" | "usdttrc20", address: string): boolean {
  if (network === "usdttrc20") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  return /^(bc1[ac-hj-np-z02-9]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/i.test(address);
}

async function sendWithdrawalCode(input: {
  userId: string;
  claims: unknown;
  amountUsdt: number;
  destination: string;
  destinationLabel: string;
}) {
  const db = await admin();
  const { data: profile } = await db.from("profiles").select("email, full_name").eq("id", input.userId).maybeSingle();
  const email = profile?.email ?? (input.claims as { email?: string } | null)?.email ?? null;
  if (!email) throw new Error("No email is saved on your account, so a code cannot be sent.");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  await db.from("withdrawal_otps").update({ consumed_at: new Date().toISOString() }).eq("user_id", input.userId).is("consumed_at", null);
  const { error } = await db.from("withdrawal_otps").insert({
    user_id: input.userId,
    code_hash: await hashCode(code),
    amount_usdt: input.amountUsdt,
    phone: input.destination,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) throw new Error("Could not start the withdrawal check. Please try again.");
  const { sendEmail } = await import("./email.server");
  const sent = await sendEmail({
    to: email,
    subject: "Your CryptoMagg withdrawal code",
    text: [`Hello${profile?.full_name ? " " + profile.full_name : ""},`, "", `Your withdrawal confirmation code is: ${code}`, "", `It confirms a withdrawal of ${input.amountUsdt.toFixed(2)} USDT to ${input.destinationLabel}.`, "The code expires in 1 minute and can be entered 3 times.", "", "If you did not request this, ignore this email and no money will leave your account.", "", "CryptoMagg"].join("\n"),
  });
  if (!sent) throw new Error("We could not email your code right now. Please try again shortly.");
  return { sentTo: email.replace(/^(.).*(@.*)$/, (_m, first: string, rest: string) => `${first}***${rest}`), expiresInSeconds: OTP_TTL_MS / 1000 };
}

/** Emails a one time code that must be entered before a payout is submitted. */
export const requestWithdrawalCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => otpRequestSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "withdrawal-code", 5);
    await requireTradingActivity(context.userId);

    const phone = normaliseKenyanPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Safaricom number, for example 0712345678.");
    const amountUsdt = Math.round(data.amountUsdt * 100) / 100;
    if (amountUsdt < LIVE_MIN_WITHDRAWAL) {
      throw new Error(`The smallest withdrawal is ${LIVE_MIN_WITHDRAWAL} USDT.`);
    }

    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("email, full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const email = profile?.email ?? (context.claims as { email?: string } | null)?.email ?? null;
    if (!email) throw new Error("No email is saved on your account, so a code cannot be sent.");

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const code = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");

    // Only the newest code can be used.
    await db
      .from("withdrawal_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("consumed_at", null);

    const { error } = await db.from("withdrawal_otps").insert({
      user_id: context.userId,
      code_hash: await hashCode(code),
      amount_usdt: amountUsdt,
      phone,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    });
    if (error) throw new Error("Could not start the withdrawal check. Please try again.");

    const { sendEmail } = await import("./email.server");
    const sent = await sendEmail({
      to: email,
      subject: "Your CryptoMagg withdrawal code",
      text: [
        `Hello${profile?.full_name ? " " + profile.full_name : ""},`,
        "",
        `Your withdrawal confirmation code is: ${code}`,
        "",
        `It confirms a withdrawal of ${amountUsdt.toFixed(2)} USDT to ${phone}.`,
        "The code expires in 1 minute and can be entered 3 times.",
        "",
        "If you did not request this, ignore this email and no money will leave your account.",
        "",
        "CryptoMagg",
      ].join("\n"),
    });
    if (!sent) throw new Error("We could not email your code right now. Please try again shortly.");

    const masked = email.replace(/^(.).*(@.*)$/, (_m, first: string, rest: string) => `${first}***${rest}`);
    return { sentTo: masked, expiresInSeconds: OTP_TTL_MS / 1000 };
  });

export const requestCryptoWithdrawalCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cryptoAddressSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "crypto-withdrawal-code", 5);
    await requireTradingActivity(context.userId);
    const amountUsdt = Math.round(data.amountUsdt * 100) / 100;
    if (amountUsdt < LIVE_MIN_WITHDRAWAL) throw new Error(`The smallest withdrawal is ${LIVE_MIN_WITHDRAWAL} USDT.`);
    if (!validCryptoAddress(data.network, data.address)) throw new Error(data.network === "btc" ? "Enter a valid Bitcoin address." : "Enter a valid USDT TRC20 address beginning with T.");
    return sendWithdrawalCode({ userId: context.userId, claims: context.claims, amountUsdt, destination: data.address, destinationLabel: data.network === "btc" ? "your Bitcoin address" : "your USDT TRC20 address" });
  });

async function consumeWithdrawalCode(userId: string, code: string, amountUsdt: number, phone: string) {
  const db = await admin();
  const { data: otp } = await db
    .from("withdrawal_otps")
    .select("*")
    .eq("user_id", userId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) throw new Error("Request a new confirmation code to continue.");
  if (new Date(otp.expires_at).getTime() <= Date.now()) {
    await db.from("withdrawal_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
    throw new Error("That code has expired. Request a new one.");
  }
  if (Number(otp.attempts) >= OTP_MAX_ATTEMPTS) {
    await db.from("withdrawal_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
    throw new Error("Too many wrong codes. Request a new one.");
  }
  if (otp.code_hash !== (await hashCode(code))) {
    await db.from("withdrawal_otps").update({ attempts: Number(otp.attempts) + 1 }).eq("id", otp.id);
    const left = OTP_MAX_ATTEMPTS - (Number(otp.attempts) + 1);
    throw new Error(left > 0 ? `That code is not correct. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong codes. Request a new one.");
  }
  if (Math.abs(Number(otp.amount_usdt) - amountUsdt) > 0.001 || otp.phone !== phone) {
    throw new Error("The amount or number changed. Request a new confirmation code.");
  }
  await db.from("withdrawal_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
}

/**
 * Requests a payout. The amount is reserved from the balance in one database
 * transaction, then queued with M Pesa. A queued payout is NOT paid: only the
 * Safaricom result callback marks it complete or refunds it.
 */
export const requestMpesaWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => withdrawalSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "withdrawal", 5);
    await requireTradingActivity(context.userId);

    const { realMoneyEnabled } = await import("./mpesa.server");
    if (!realMoneyEnabled()) throw new Error("Withdrawals are not switched on yet.");

    const b2c = await import("./mpesa-b2c.server");
    if (!b2c.b2cConfigured()) throw new Error("Withdrawals are temporarily unavailable.");
    const block = await b2c.readB2cBlock();
    if (block.blocked) throw new Error("Withdrawals are temporarily unavailable.");

    const phone = normaliseKenyanPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Safaricom number, for example 0712345678.");

    const amountUsdt = Math.round(data.amountUsdt * 100) / 100;
    if (amountUsdt < LIVE_MIN_WITHDRAWAL) {
      throw new Error(`The smallest withdrawal is ${LIVE_MIN_WITHDRAWAL} USDT.`);
    }

    const rate = await usdKesRate();
    if (rate === null) throw new Error("The shilling rate is unavailable. Please try again shortly.");
    const amountKes = Math.max(1, Math.round(amountUsdt * rate));

    // No money moves until the emailed one time code checks out.
    await consumeWithdrawalCode(context.userId, data.code, amountUsdt, phone);

    const db = await admin();
    const originatorConversationId = crypto.randomUUID();
    const { data: rows, error } = await db.rpc("hold_withdrawal_for_payout", {
      p_user_id: context.userId,
      p_amount: amountUsdt,
      p_phone: phone,
      p_originator_conversation_id: originatorConversationId,
    });
    const created = rows?.[0];
    if (error || !created) {
      const message = error?.message ?? "";
      if (message.includes("Pending withdrawal")) {
        throw new Error("You already have a withdrawal being processed. Please wait for it to finish.");
      }
      throw new Error(
        message.includes("Insufficient")
          ? "That is more than your available balance."
          : "Could not submit the withdrawal. Please try again.",
      );
    }

    let queued = false;
    try {
      const submission = await b2c.submitB2cPayout({
        phone,
        amountKes,
        originatorConversationId,
        remarks: "Withdrawal",
      });
      if (submission.queued) {
        queued = true;
        await db
          .from("withdrawal_requests")
          .update({
            provider_conversation_id: submission.conversationId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", created.id);
      } else {
        await db.rpc("refund_pending_withdrawal", {
          p_request_id: created.id,
          p_failure_reason: submission.description.slice(0, 200),
        });
      }
    } catch (payoutError) {
      console.error("[b2c] payout submission error", payoutError);
      await db.rpc("refund_pending_withdrawal", {
        p_request_id: created.id,
        p_failure_reason: "provider_unreachable",
      });
    }

    if (!queued) {
      return {
        ok: false as const,
        error:
          "M Pesa did not accept the payout request, so the amount was returned to your balance. Please try again.",
      };
    }

    try {
      const { data: profile } = await db
        .from("profiles")
        .select("email, full_name")
        .eq("id", context.userId)
        .maybeSingle();
      if (profile?.email) {
        const { sendWithdrawalReceipt } = await import("./email.server");
        await sendWithdrawalReceipt({
          to: profile.email,
          name: profile.full_name,
          amountUsdt,
          phone,
          status: "pending",
        });
      }
    } catch (mailError) {
      console.error("Withdrawal email failed", mailError);
    }

    return { ok: true as const, id: created.id, amountUsdt, status: "pending" as const };
  });

export const requestCryptoWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cryptoWithdrawalSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "crypto-withdrawal", 5);
    await requireTradingActivity(context.userId);
    const amountUsdt = Math.round(data.amountUsdt * 100) / 100;
    if (amountUsdt < LIVE_MIN_WITHDRAWAL) throw new Error(`The smallest withdrawal is ${LIVE_MIN_WITHDRAWAL} USDT.`);
    if (!validCryptoAddress(data.network, data.address)) throw new Error(data.network === "btc" ? "Enter a valid Bitcoin address." : "Enter a valid USDT TRC20 address beginning with T.");
    const provider = await import("./crypto-payout.server");
    if (!provider.cryptoPayoutConfigured()) throw new Error("Crypto withdrawals are temporarily unavailable.");
    await consumeWithdrawalCode(context.userId, data.code, amountUsdt, data.address);
    const db = await admin();
    const asset = data.network === "btc" ? "BTC" : "USDT";
    const { data: rows, error } = await db.rpc("hold_crypto_withdrawal", { p_user_id: context.userId, p_amount: amountUsdt, p_asset: asset, p_network: data.network, p_address: data.address });
    const created = rows?.[0];
    if (error || !created) {
      const detail = error?.message ?? "";
      if (detail.includes("Pending withdrawal")) throw new Error("You already have a withdrawal being processed. Please wait for it to finish.");
      throw new Error(detail.includes("Insufficient") ? "That is more than your available balance." : "Could not submit the withdrawal. Please try again.");
    }
    try {
      const submitted = await provider.submitCryptoPayout({ requestId: created.id, network: data.network, address: data.address, amount: amountUsdt });
      await db.from("crypto_withdrawals").update({ provider_payout_id: submitted.providerId, updated_at: new Date().toISOString() }).eq("id", created.id);
      return { ok: true as const, id: created.id, status: "pending" as const };
    } catch (providerError) {
      console.error("Crypto payout submission failed", providerError instanceof Error ? providerError.message : "unknown");
      await db.rpc("finalize_crypto_withdrawal", { p_request_id: created.id, p_provider_id: "", p_success: false, p_tx_hash: "", p_failure_reason: "provider_unreachable" });
      return { ok: false as const, error: "The crypto payout was not accepted, so the amount was returned to your balance." };
    }
  });

/** The trader's own funding history for the real account. */
export const getFundingActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const [deposits, withdrawals, cryptoWithdrawals] = await Promise.all([
      db
        .from("deposit_intents")
        .select("id, amount_usdt, amount_kes, status, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("withdrawal_requests")
        .select("id, amount_usdt, status, created_at, provider_receipt, failure_reason")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      db.from("crypto_withdrawals").select("id, amount_usdt, asset, network, destination_address, status, tx_hash, failure_reason, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(20),
    ]);
    return { deposits: deposits.data ?? [], withdrawals: withdrawals.data ?? [], cryptoWithdrawals: cryptoWithdrawals.data ?? [] };
  });
