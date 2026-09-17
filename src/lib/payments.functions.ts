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
      return { id: intent.id, amountUsdt, amountKes, phone };
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
        throw new Error(
          "M Pesa rejected the app login. Deposits are paused until the M Pesa keys are corrected.",
        );
      }
      throw new Error("M Pesa could not be reached. Please try again in a moment.");
    }
  });

const withdrawalSchema = z.object({
  amountUsdt: z.number().positive().max(100_000),
  phone: z.string().trim().min(9).max(20),
});

/**
 * Requests a payout. The amount leaves the balance immediately so it cannot be
 * traded or withdrawn twice, then waits for review before M Pesa pays out.
 */
export const requestMpesaWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => withdrawalSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "withdrawal", 5);

    const { realMoneyEnabled } = await import("./mpesa.server");
    if (!realMoneyEnabled()) throw new Error("Withdrawals are not switched on yet.");

    const phone = normaliseKenyanPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Safaricom number, for example 0712345678.");

    const amountUsdt = Math.round(data.amountUsdt * 100) / 100;
    if (amountUsdt < LIVE_MIN_WITHDRAWAL) {
      throw new Error(`The smallest withdrawal is ${LIVE_MIN_WITHDRAWAL} USDT.`);
    }

    const db = await admin();
    const { data: rows, error } = await db.rpc("hold_withdrawal_amount", {
      p_user_id: context.userId,
      p_amount: amountUsdt,
      p_phone: phone,
    });
    const created = rows?.[0];
    if (error || !created) {
      throw new Error(
        error?.message.includes("Insufficient")
          ? "That is more than your available balance."
          : "Could not submit the withdrawal. Please try again.",
      );
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

    return { id: created.id, amountUsdt };
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
        .select("id, amount_usdt, status, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return { deposits: deposits.data ?? [], withdrawals: withdrawals.data ?? [] };
  });
