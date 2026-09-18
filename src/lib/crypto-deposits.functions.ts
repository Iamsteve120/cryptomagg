import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { USDT_DEPOSIT_ADDRESSES, USDT_MIN_DEPOSIT } from "./live-trading";

const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimit(userId: string, maximum: number) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= maximum) throw new Error("Too many checks. Please wait a moment.");
  recent.push(now);
  hits.set(userId, recent);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const schema = z.object({ txHash: z.string().trim().min(60).max(80) });

/**
 * Confirms a USDT (TRC 20) transfer on the Tron network and credits the real
 * balance once, using the amount the chain reports.
 */
export const confirmUsdtDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, 10);

    const addresses = USDT_DEPOSIT_ADDRESSES.map((entry) => entry.address);
    const { verifyUsdtTransfer } = await import("./tron.server");
    const result = await verifyUsdtTransfer(data.txHash, addresses);

    if (!result.ok) {
      if (result.reason === "network_error") {
        return { ok: false as const, error: "The Tron network could not be reached. Please try again shortly." };
      }
      if (result.reason === "wrong_address") {
        return { ok: false as const, error: "That transfer was not sent to a CryptoMagg deposit address." };
      }
      return {
        ok: false as const,
        error:
          "We cannot see that transfer yet. New transfers can take a few minutes to confirm, then check again.",
      };
    }

    if (result.amountUsdt < USDT_MIN_DEPOSIT) {
      return {
        ok: false as const,
        error: `The smallest USDT deposit is ${USDT_MIN_DEPOSIT} USDT. That transfer was ${result.amountUsdt} USDT.`,
      };
    }

    const db = await admin();
    const { data: balance, error } = await db.rpc("credit_crypto_deposit", {
      p_user_id: context.userId,
      p_tx_hash: data.txHash.trim().toLowerCase().replace(/^0x/, ""),
      p_amount: result.amountUsdt,
      p_network: "trc20",
      p_address: addresses[0] ?? "",
    });

    if (error) {
      if (error.message.includes("already credited")) {
        return { ok: false as const, error: "That transfer has already been credited." };
      }
      return { ok: false as const, error: "Could not credit the deposit. Please try again." };
    }

    try {
      const { data: profile } = await db
        .from("profiles")
        .select("email, full_name")
        .eq("id", context.userId)
        .maybeSingle();
      if (profile?.email) {
        const { sendDepositReceipt } = await import("./email.server");
        await sendDepositReceipt({
          to: profile.email,
          name: profile.full_name,
          amountUsdt: result.amountUsdt,
          receipt: data.txHash.trim(),
        });
      }
    } catch (mailError) {
      console.error("USDT deposit email failed", mailError);
    }

    return { ok: true as const, amountUsdt: result.amountUsdt, balance: Number(balance) };
  });

/** The trader's own USDT deposit history. */
export const getUsdtDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data } = await db
      .from("crypto_deposits")
      .select("id, amount_usdt, status, tx_hash, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { deposits: data ?? [] };
  });
