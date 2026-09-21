import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
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

/** Tells the app whether real money can move yet, without leaking any credentials. */
export const getLiveAccountStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { realMoneyEnabled, readDarajaConfig, sandboxMode, probeLiveAuth } = await import(
    "./mpesa.server"
  );
  const config = readDarajaConfig();
  const diagnostics = config
    ? {
        consumerKeyLength: config.consumerKey.length,
        consumerSecretLength: config.consumerSecret.length,
        passkeyLength: config.passkey.length,
        shortcode: config.shortcode,
        partyB: config.partyB,
        callbackUrlHost: config.callbackUrl.split("/")[2] ?? config.callbackUrl,
        authProbe: await probeLiveAuth(config),
      }
    : {
        consumerKeyLength: (process.env["CONSUMER_KEY"] ?? process.env["MPESA_CONSUMER_KEY"] ?? "")
          .length,
        consumerSecretLength: (
          process.env["CONSUMER_SECRET"] ?? process.env["MPESA_CONSUMER_SECRET"] ?? ""
        ).length,
        passkeyLength: (process.env["MPESA_PASSKEY"] ?? "").length,
        shortcode: process.env["LNM_SHORTCODE"] ?? process.env["MPESA_SHORTCODE"] ?? "",
        partyB: process.env["PARTY_B"] ?? "",
        callbackUrlHost: "",
        authProbe: "missing_config" as const,
      };
  return {
    enabled: realMoneyEnabled(),
    providerConfigured: config !== null,
    sandbox: sandboxMode(),
    diagnostics,
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

/** The trader's own funding history for the real account. */
export const getFundingActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const [deposits, withdrawals] = await Promise.all([
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
    ]);
    return { deposits: deposits.data ?? [], withdrawals: withdrawals.data ?? [] };
  });
