import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ASSETS, DEPOSIT_METHODS, DURATIONS } from "./assets";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const hits = new Map<string, number[]>();

function rateLimit(userId: string, bucket: string, maximum = RATE_MAX) {
  const key = userId + ":" + bucket;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= maximum) throw new Error("Too many requests. Please slow down.");
  recent.push(now);
  hits.set(key, recent);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function ensureProfile(userId: string, email: string | null) {
  const db = await admin();
  const { data } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  let profile = data;
  if (!profile) {
    const { data: created, error } = await db
      .from("profiles")
      .insert({ id: userId, email, demo_balance: 10000 })
      .select("*")
      .single();
    if (error) throw new Error("Could not prepare your demo account.");
    profile = created;
  }

  // Every account carries a permanent client ID, and the details captured at
  // sign up are copied onto the profile the first time the client is seen.
  if (!profile.client_id) {
    const { data: clientId } = await db.rpc("next_client_id");
    const { data: userRecord } = await db.auth.admin.getUserById(userId);
    const meta = (userRecord?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const text = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 120) : null;
    const patch: {
      client_id: string | null;
      first_name?: string | null;
      last_name?: string | null;
      country?: string | null;
      phone?: string | null;
      full_name?: string | null;
      age_confirmed?: boolean;
      terms_accepted_at?: string;
    } = { client_id: (clientId as string | null) ?? null };

    if (!profile.first_name && text(meta["first_name"])) patch["first_name"] = text(meta["first_name"]);
    if (!profile.last_name && text(meta["last_name"])) patch["last_name"] = text(meta["last_name"]);
    if (!profile.country && text(meta["country"])) patch["country"] = text(meta["country"]);
    if (!profile.phone && text(meta["phone"])) patch["phone"] = text(meta["phone"]);
    if (!profile.full_name) {
      patch["full_name"] =
        text(meta["full_name"]) ??
        [text(meta["first_name"]), text(meta["last_name"])].filter(Boolean).join(" ") ??
        null;
    }
    if (meta["age_confirmed"] === true) patch["age_confirmed"] = true;
    if (meta["terms_accepted"] === true && !profile.terms_accepted_at) {
      patch["terms_accepted_at"] = new Date().toISOString();
    }
    const { data: updated } = await db
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("*")
      .single();
    if (updated) profile = updated;
  }

  return profile;
}


/**
 * Real trades settle on the published series at the exact expiry moment: up
 * wins when the level is above entry, down wins when it is below.
 *
 * Synthetic instruments settle at the price the series held at expiry, which
 * anyone can recompute from the instrument and the timestamp. Exchange pairs
 * settle at the exchange price. Nothing here can favour the house or a trader.
 */
async function settleDueLiveTrades(userId: string) {
  const db = await admin();
  const { data: open } = await db
    .from("trades")
    .select("id, symbol, entry_price, expires_at")
    .eq("user_id", userId)
    .eq("status", "open")
    .eq("account_mode", "live");
  if (!open || open.length === 0) return;

  const { fetchMarketQuotes } = await import("./market.server");
  const quotes = await fetchMarketQuotes();
  for (const trade of open) {
    const expiresAt = new Date(trade.expires_at).getTime();
    if (expiresAt > Date.now()) continue;
    const exit = quotes.find((q) => q.symbol === trade.symbol)?.price;
    if (!exit || exit <= 0) continue; // Never settle a real trade on a guessed price.
    const { error } = await db.rpc("settle_live_trade_at_market", {
      p_user_id: userId,
      p_trade_id: trade.id,
      p_exit_price: exit,
    });
    if (error) console.error("Live settlement failed", trade.id, error.message);
  }
}

async function settleDueTrades(userId: string) {
  const db = await admin();
  const { data: open } = await db
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .eq("account_mode", "demo");

  if (!open || open.length === 0) return;

  const { fetchMarketQuotes } = await import("./market.server");
  const quotes = await fetchMarketQuotes();
  for (const trade of open) {
    const quote = quotes.find((q) => q.symbol === trade.symbol);
    const exit = quote ? quote.price : Number(trade.entry_price);
    const tp = trade.take_profit_price === null ? null : Number(trade.take_profit_price);
    const sl = trade.stop_loss_price === null ? null : Number(trade.stop_loss_price);
    const levelReached = trade.direction === "up"
      ? (tp !== null && exit >= tp) || (sl !== null && exit <= sl)
      : (tp !== null && exit <= tp) || (sl !== null && exit >= sl);
    const expired = new Date(trade.expires_at).getTime() <= Date.now();
    if (!levelReached && !expired) continue;

    const { error } = levelReached
      ? await db.rpc("close_demo_trade_at_live_pnl", {
          p_user_id: userId,
          p_trade_id: trade.id,
          p_exit_price: exit,
        })
      : await db.rpc("settle_demo_trade", {
          p_user_id: userId,
          p_trade_id: trade.id,
          p_exit_price: exit,
        });
    if (error) console.error("Trade settlement failed", trade.id, error.message);
  }
}

export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    await ensureProfile(context.userId, email);
    await settleDueTrades(context.userId);
    await settleDueLiveTrades(context.userId);

    const db = await admin();
    const [profileRes, tradesRes, txRes] = await Promise.all([
      db.from("profiles").select("*").eq("id", context.userId).single(),
      db
        .from("trades")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(60),
      db
        .from("transactions")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const trades = tradesRes.data ?? [];
    const settled = trades.filter((t) => t.status !== "open");
    const wins = settled.filter((t) => t.status === "won").length;

    return {
      profile: profileRes.data,
      trades,
      transactions: txRes.data ?? [],
      stats: {
        totalTrades: settled.length,
        openTrades: trades.filter((t) => t.status === "open").length,
        winRate: settled.length ? Math.round((wins / settled.length) * 100) : 0,
        netPnl: settled.reduce((sum, t) => sum + Number(t.pnl), 0),
      },
    };
  });

const fundsSchema = z.object({
  kind: z.enum(["deposit", "withdrawal"]),
  accountMode: z.enum(["demo", "live"]).default("demo"),
  method: z.string().min(1).max(40),
  amount: z.number().positive().max(1_000_000),
  destination: z.string().max(120).optional(),
});

export const moveFunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => fundsSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "funds");
    if (data.accountMode === "demo") {
      throw new Error("Demo deposits and withdrawals are unavailable.");
    }
    if (data.accountMode === "live") {
      throw new Error("Real deposits and withdrawals are not available.");
    }
    const method = DEPOSIT_METHODS.find((m) => m.id === data.method);
    if (!method) throw new Error("Unsupported method.");

    const amount = Math.round(data.amount * 100) / 100;
    if (amount < 1) throw new Error("Minimum amount is 1.00 USD.");

    const profile = await ensureProfile(context.userId, null);
    const balance = Number(profile.demo_balance);

    if (data.kind === "withdrawal" && amount > balance) {
      throw new Error("Amount exceeds your demo balance.");
    }

    const db = await admin();
    const next = data.kind === "deposit" ? balance + amount : balance - amount;

    const { error: txError } = await db.from("transactions").insert({
      user_id: context.userId,
      kind: data.kind,
      method: method.id,
      asset: method.asset,
      amount,
      status: "completed",
      account_mode: "demo",
      destination: data.destination ?? null,
    });
    if (txError) throw new Error("Could not record the simulated transaction.");

    await db
      .from("profiles")
      .update({ demo_balance: next, updated_at: new Date().toISOString() })
      .eq("id", context.userId);

    return { balance: next, amount, kind: data.kind };
  });

const tradeSchema = z.object({
  accountMode: z.enum(["demo", "live"]).default("demo"),
  symbol: z.string().min(2).max(10),
  direction: z.enum(["up", "down"]),
  stake: z.number().min(1).max(2000),
  durationSeconds: z.number().int(),
  source: z.enum(["manual", "assist", "auto", "scanner"]).default("manual"),
  takeProfitPercent: z.number().min(0.1).max(2000),
  stopLossPercent: z.number().min(0.1).max(2000),
}).superRefine((data, context) => {
  if (data.stopLossPercent > data.stake) context.addIssue({ code: "custom", path: ["stopLossPercent"], message: "Stop Loss cannot exceed the trade amount." });
});

export const placeTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tradeSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "trade", data.source === "auto" ? 45 : RATE_MAX);

    const { SYNTHETIC_INSTRUMENTS } = await import("./synthetic");
    const synthetic = SYNTHETIC_INSTRUMENTS.find((instrument) => instrument.symbol === data.symbol);
    const asset = synthetic
      ? { symbol: synthetic.symbol, name: synthetic.name, payoutRate: synthetic.payoutRate }
      : ASSETS.find((a) => a.symbol === data.symbol);
    if (!asset) throw new Error("Unsupported asset.");
    if (!DURATIONS.some((d) => d.seconds === data.durationSeconds)) {
      throw new Error("Unsupported duration.");
    }

    if (data.accountMode === "live") {
      const { realMoneyEnabled } = await import("./mpesa.server");
      if (!realMoneyEnabled()) throw new Error("Real trading is not switched on yet.");
      if (!synthetic) throw new Error("Real accounts trade the synthetic crypto instruments only.");

      const { LIVE_MAX_OPEN_TRADES_PER_TRADER, LIVE_MAX_STAKE, LIVE_MAX_TOTAL_EXPOSURE, LIVE_MIN_STAKE, LIVE_PAYOUT_RATE } = await import("./live-trading");
      const liveStake = Math.round(data.stake * 100) / 100;
      if (liveStake < LIVE_MIN_STAKE || liveStake > LIVE_MAX_STAKE) {
        throw new Error(`Real trades must be between ${LIVE_MIN_STAKE} and ${LIVE_MAX_STAKE} USDT.`);
      }

      const liveDb = await admin();
      const { data: myOpen } = await liveDb
        .from("trades")
        .select("id")
        .eq("user_id", context.userId)
        .eq("account_mode", "live")
        .eq("status", "open");
      if ((myOpen?.length ?? 0) >= LIVE_MAX_OPEN_TRADES_PER_TRADER) {
        throw new Error(`You can have at most ${LIVE_MAX_OPEN_TRADES_PER_TRADER} open real trades. Wait for one to settle.`);
      }
      const { data: allOpen } = await liveDb
        .from("trades")
        .select("stake")
        .eq("account_mode", "live")
        .eq("status", "open");
      const exposure = (allOpen ?? []).reduce((sum, t) => sum + Number(t.stake), 0);
      if (exposure + liveStake > LIVE_MAX_TOTAL_EXPOSURE) {
        throw new Error("The market is at its trading limit right now. Please try a smaller amount or wait.");
      }

      await ensureProfile(context.userId, null);
      const { priceForSymbol } = await import("./market.server");
      const liveEntry = await priceForSymbol(asset.symbol);
      if (!Number.isFinite(liveEntry) || liveEntry <= 0) {
        throw new Error("The market price is unavailable. Please try again shortly.");
      }

      const { data: liveRows, error: liveError } = await liveDb.rpc("reserve_live_trade", {
        p_user_id: context.userId,
        p_symbol: asset.symbol,
        p_asset_name: asset.name,
        p_direction: data.direction,
        p_stake: liveStake,
        p_payout_rate: LIVE_PAYOUT_RATE,
        p_duration_seconds: data.durationSeconds,
        p_entry_price: liveEntry,
        p_expires_at: new Date(Date.now() + data.durationSeconds * 1000).toISOString(),
      });
      const liveTrade = liveRows?.[0];
      if (liveError || !liveTrade) {
        throw new Error(
          liveError?.message.includes("Insufficient")
            ? "That is more than your available balance."
            : "Could not open the trade. Please try again.",
        );
      }
      if (data.source !== "manual") {
        // Keep bot-opened real trades tagged so the bot session view and stop control see them.
        await liveDb.from("trades").update({ trade_source: data.source }).eq("id", liveTrade.id);
        liveTrade.trade_source = data.source;
      }
      return { trade: liveTrade, balance: Number(liveTrade.balance_after_open) };
    }


    const stake = Math.round(data.stake * 100) / 100;
    const minimumStake = data.source === "auto" ? 1 : 5;
    const maximumStake = data.source === "auto" ? 2000 : 500;
    if (stake < minimumStake || stake > maximumStake) throw new Error(data.source === "auto" ? "Bot amount must be between 1.00 and 2,000.00 USD." : "Demo stake must be between 5.00 and 500.00 USD.");

    await ensureProfile(context.userId, null);

    const { priceForSymbol } = await import("./market.server");
    const entry = await priceForSymbol(asset.symbol);

    const db = await admin();
    const expiresAt = new Date(Date.now() + data.durationSeconds * 1000).toISOString();

    const { data: rows, error } = await db.rpc("reserve_demo_trade_with_risk", {
      p_user_id: context.userId,
      p_symbol: asset.symbol,
      p_asset_name: asset.name,
      p_direction: data.direction,
      p_stake: stake,
      p_payout_rate: asset.payoutRate,
      p_duration_seconds: data.durationSeconds,
      p_entry_price: entry,
      p_expires_at: expiresAt,
      p_trade_source: data.source,
      p_take_profit_percent: data.takeProfitPercent,
      p_stop_loss_percent: data.stopLossPercent,
    });
    const trade = rows?.[0];
    if (error || !trade) {
      console.error("reserve_demo_trade_with_risk failed", JSON.stringify(error), JSON.stringify({ stake, entry, tp: data.takeProfitPercent, sl: data.stopLossPercent, duration: data.durationSeconds, source: data.source, symbol: data.symbol }));
      throw new Error(error?.message.includes("Insufficient") ? "Not enough demo balance." : "Could not open the simulated trade.");
    }

    return { trade, balance: Number(trade.balance_after_open) };
  });

const stopTradeSchema = z.object({ tradeId: z.string().uuid() });

export const stopDemoTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => stopTradeSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "stop-trade");
    const db = await admin();
    const { data: trade } = await db
      .from("trades")
      .select("id, symbol, status, account_mode, entry_price")
      .eq("id", data.tradeId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!trade || trade.status !== "open") {
      // The trade already closed at TP, SL, or expiry between the click and this call.
      return { trade: null, balance: null, alreadyClosed: true as const };
    }

    const { priceForSymbol } = await import("./market.server");
    // Never let a price provider hiccup block closing: fall back to the entry price.
    const exitPrice = await priceForSymbol(trade.symbol).catch(() => Number((trade as { entry_price?: number }).entry_price) || 0);
    const { data: rows, error } = await db.rpc(
      trade.account_mode === "live" ? "settle_live_trade_at_market" : "close_demo_trade_at_live_pnl",
      {
        p_user_id: context.userId,
        p_trade_id: trade.id,
        p_exit_price: exitPrice,
      },
    );
    const closed = rows?.[0];
    if (error || !closed) throw new Error("Could not stop the trade.");
    return { trade: closed, balance: Number(closed.balance_after_settlement) };
  });

export const stopAllDemoTrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    rateLimit(context.userId, "stop-all", 30);
    const db = await admin();
    const { data: open } = await db
      .from("trades")
      .select("id, symbol, entry_price, account_mode")
      .eq("user_id", context.userId)
      .eq("status", "open");
    if (!open || open.length === 0) return { closed: 0 };

    const { priceForSymbol } = await import("./market.server");
    const prices = new Map<string, number>();
    let closed = 0;
    let failed = 0;
    for (const trade of open) {
      try {
        let price = prices.get(trade.symbol);
        if (price === undefined) {
          // A price provider hiccup must never block closing: fall back to the entry price.
          price = await priceForSymbol(trade.symbol).catch(() => Number(trade.entry_price));
          prices.set(trade.symbol, price);
        }
        const { error } = await db.rpc(
          trade.account_mode === "live" ? "settle_live_trade_at_market" : "close_demo_trade_at_live_pnl",
          {
            p_user_id: context.userId,
            p_trade_id: trade.id,
            p_exit_price: price,
          },
        );
        if (error) {
          failed += 1;
          console.error("Stop-all failed for trade", trade.id, error.message);
        } else {
          closed += 1;
        }
      } catch (stepError) {
        failed += 1;
        console.error("Stop-all failed for trade", trade.id, stepError);
      }
    }
    if (closed === 0 && failed > 0) throw new Error("Could not close the open trades. Please try again.");
    return { closed };
  });

export const resetDemoAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    rateLimit(context.userId, "reset");
    const db = await admin();
    await ensureProfile(context.userId, null);
    await db.from("trades").delete().eq("user_id", context.userId).eq("account_mode", "demo");
    await db.from("transactions").delete().eq("user_id", context.userId).eq("account_mode", "demo");
    await db
      .from("profiles")
      .update({ demo_balance: 10000, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { balance: 10000 };
  });

const nameSchema = z.object({ fullName: z.string().trim().min(1).max(60) });

export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => nameSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "profile");
    const db = await admin();
    await ensureProfile(context.userId, null);
    await db
      .from("profiles")
      .update({ full_name: data.fullName, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { fullName: data.fullName };
  });
