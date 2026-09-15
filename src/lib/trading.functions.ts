import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ASSETS, DEPOSIT_METHODS, DURATIONS } from "./assets";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const hits = new Map<string, number[]>();

function rateLimit(userId: string, bucket: string) {
  const key = userId + ":" + bucket;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) throw new Error("Too many requests. Please slow down.");
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
  if (data) return data;
  const { data: created, error } = await db
    .from("profiles")
    .insert({ id: userId, email, demo_balance: 10000 })
    .select("*")
    .single();
  if (error) throw new Error("Could not prepare your demo account.");
  return created;
}

async function settleDueTrades(userId: string) {
  const db = await admin();
  const { data: open } = await db
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .eq("account_mode", "demo")
    .lte("expires_at", new Date().toISOString());

  if (!open || open.length === 0) return;

  const { fetchMarketQuotes } = await import("./market.server");
  const quotes = await fetchMarketQuotes();
  let credit = 0;

  for (const trade of open) {
    const quote = quotes.find((q) => q.symbol === trade.symbol);
    const exit = quote ? quote.price : Number(trade.entry_price);
    const entry = Number(trade.entry_price);
    const stake = Number(trade.stake);
    let status: "won" | "lost" | "tie" = "tie";
    let pnl = 0;

    if (exit === entry) {
      status = "tie";
      pnl = 0;
      credit += stake;
    } else {
      const wentUp = exit > entry;
      const won = trade.direction === "up" ? wentUp : !wentUp;
      status = won ? "won" : "lost";
      pnl = won ? (stake * Number(trade.payout_rate)) / 100 : -stake;
      if (won) credit += stake + pnl;
    }

    await db
      .from("trades")
      .update({
        status,
        pnl,
        exit_price: exit,
        settled_at: new Date().toISOString(),
      })
      .eq("id", trade.id)
      .eq("status", "open");
  }

  if (credit > 0) {
    const { data: profile } = await db
      .from("profiles")
      .select("demo_balance")
      .eq("id", userId)
      .single();
    const next = Number(profile?.demo_balance ?? 0) + credit;
    await db
      .from("profiles")
      .update({ demo_balance: next, updated_at: new Date().toISOString() })
      .eq("id", userId);
  }
}

export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    await ensureProfile(context.userId, email);
    await settleDueTrades(context.userId);

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
    if (data.accountMode === "live") {
      throw new Error("Live deposits and withdrawals are unavailable until payment verification is complete.");
    }
    const method = DEPOSIT_METHODS.find((m) => m.id === data.method);
    if (!method) throw new Error("Unsupported method.");

    const amount = Math.round(data.amount * 100) / 100;
  if (amount < 2) throw new Error("Minimum amount is 2.00 demo USD.");

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
  stake: z.number().positive().max(1_000_000),
  durationSeconds: z.number().int(),
});

export const placeTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tradeSchema.parse(data))
  .handler(async ({ data, context }) => {
    rateLimit(context.userId, "trade");
    if (data.accountMode === "live") {
      throw new Error("Live trading is unavailable until account verification is complete.");
    }

    const asset = ASSETS.find((a) => a.symbol === data.symbol);
    if (!asset) throw new Error("Unsupported asset.");
    if (!DURATIONS.some((d) => d.seconds === data.durationSeconds)) {
      throw new Error("Unsupported duration.");
    }

    const stake = Math.round(data.stake * 100) / 100;
    if (stake < 1) throw new Error("Minimum stake is 1.00 demo USD.");

    const profile = await ensureProfile(context.userId, null);
    const balance = Number(profile.demo_balance);
    if (stake > balance) throw new Error("Not enough demo balance.");

    const { priceForSymbol } = await import("./market.server");
    const entry = await priceForSymbol(asset.symbol);

    const db = await admin();
    const expiresAt = new Date(Date.now() + data.durationSeconds * 1000).toISOString();

    const { data: trade, error } = await db
      .from("trades")
      .insert({
        user_id: context.userId,
        symbol: asset.symbol,
        asset_name: asset.name,
        direction: data.direction,
        stake,
        payout_rate: asset.payoutRate,
        duration_seconds: data.durationSeconds,
        entry_price: entry,
        expires_at: expiresAt,
        account_mode: "demo",
      })
      .select("*")
      .single();
    if (error) throw new Error("Could not open the simulated trade.");

    await db
      .from("profiles")
      .update({ demo_balance: balance - stake, updated_at: new Date().toISOString() })
      .eq("id", context.userId);

    return { trade, balance: balance - stake };
  });

export const resetDemoAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    rateLimit(context.userId, "reset");
    const db = await admin();
    await ensureProfile(context.userId, null);
    await db.from("trades").delete().eq("user_id", context.userId);
    await db.from("transactions").delete().eq("user_id", context.userId);
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
