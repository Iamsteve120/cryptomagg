import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Selectable reporting windows, in minutes. */
export const ADMIN_RANGES = {
  "10m": { label: "10 min", minutes: 10 },
  "30m": { label: "30 min", minutes: 30 },
  "1h": { label: "1 hr", minutes: 60 },
  "6h": { label: "6 hrs", minutes: 360 },
  "12h": { label: "12 hrs", minutes: 720 },
  "1d": { label: "1 day", minutes: 1440 },
  "72h": { label: "72 hrs", minutes: 4320 },
  "1w": { label: "1 week", minutes: 10080 },
  "15d": { label: "15 days", minutes: 21600 },
  "1mo": { label: "1 month", minutes: 43200 },
} as const;

export type AdminRangeKey = keyof typeof ADMIN_RANGES;

const RANGE_KEYS = Object.keys(ADMIN_RANGES) as AdminRangeKey[];

function normaliseRange(value: unknown): AdminRangeKey {
  return RANGE_KEYS.includes(value as AdminRangeKey) ? (value as AdminRangeKey) : "1d";
}

type AuthContext = { supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }; userId: string };

/**
 * Every admin read is gated here: the role lives in its own table and is read
 * through the caller's own session, so a client cannot claim to be an admin.
 */
async function requireAdmin(context: AuthContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("You do not have access to this area.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true };
  });

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { range?: string }) => ({ range: normaliseRange(input?.range) }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context as unknown as AuthContext);
    const minutes = ADMIN_RANGES[data.range].minutes;
    const now = Date.now();
    const windowMs = minutes * 60_000;
    const startIso = new Date(now - windowMs).toISOString();
    const prevIso = new Date(now - windowMs * 2).toISOString();
    const onlineIso = new Date(now - 5 * 60_000).toISOString();

    const [profilesRes, txRes, tradesRes, loginsRes] = await Promise.all([
      db.from("profiles").select("id, created_at, last_seen_at, live_balance, demo_balance"),
      db
        .from("transactions")
        .select("user_id, kind, amount, status, account_mode, created_at")
        .gte("created_at", prevIso),
      db
        .from("trades")
        .select("user_id, stake, status, pnl, account_mode, created_at")
        .gte("created_at", prevIso),
      db.from("login_events").select("user_id, created_at").gte("created_at", prevIso),
    ]);

    const profiles = profilesRes.data ?? [];
    const transactions = txRes.data ?? [];
    const trades = tradesRes.data ?? [];
    const logins = loginsRes.data ?? [];

    const inWindow = (iso: string | null, from: string, to?: string) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      const toTime = to ? new Date(to).getTime() : now;
      return t >= new Date(from).getTime() && t <= toTime;
    };

    function bucket(from: string, to?: string) {
      const signups = profiles.filter((p) => inWindow(p.created_at, from, to)).length;
      const activeIds = new Set<string>();
      logins.filter((l) => inWindow(l.created_at, from, to)).forEach((l) => activeIds.add(l.user_id));
      trades.filter((t) => inWindow(t.created_at, from, to)).forEach((t) => activeIds.add(t.user_id));
      const tx = transactions.filter((t) => inWindow(t.created_at, from, to));
      const liveTx = tx.filter((t) => t.account_mode === "live");
      const deposits = liveTx
        .filter((t) => t.kind === "deposit" && t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const withdrawals = liveTx
        .filter((t) => t.kind === "withdrawal" && t.status !== "failed")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const windowTrades = trades.filter((t) => inWindow(t.created_at, from, to));
      const liveTrades = windowTrades.filter((t) => t.account_mode === "live");
      const staked = liveTrades.reduce((sum, t) => sum + Number(t.stake), 0);
      const traderPnl = liveTrades
        .filter((t) => t.status !== "open")
        .reduce((sum, t) => sum + Number(t.pnl), 0);
      return {
        signups,
        active: activeIds.size,
        deposits,
        withdrawals,
        trades: windowTrades.length,
        liveTrades: liveTrades.length,
        staked,
        wins: liveTrades.filter((t) => t.status === "won").length,
        losses: liveTrades.filter((t) => t.status === "lost").length,
        housePnl: -traderPnl,
      };
    }

    const current = bucket(startIso);
    const previous = bucket(prevIso, startIso);

    const totalClients = profiles.length;
    const onlineNow = new Set(
      profiles.filter((p) => inWindow(p.last_seen_at, onlineIso)).map((p) => p.id),
    ).size;
    const liveFloat = profiles.reduce((sum, p) => sum + Number(p.live_balance), 0);

    const metric = (
      label: string,
      value: number,
      prev: number,
      kind: "count" | "money",
    ) => ({ label, value, kind, deltaPct: pct(value, prev) });

    return {
      range: data.range,
      generatedAt: new Date(now).toISOString(),
      headline: [
        { label: "Total clients", value: totalClients, kind: "count" as const, deltaPct: null },
        { label: "Active online now", value: onlineNow, kind: "count" as const, deltaPct: null },
        { label: "Client balances held", value: liveFloat, kind: "money" as const, deltaPct: null },
      ],
      metrics: [
        metric("New sign ups", current.signups, previous.signups, "count"),
        metric("Active clients", current.active, previous.active, "count"),
        metric("Deposited", current.deposits, previous.deposits, "money"),
        metric("Withdrawn", current.withdrawals, previous.withdrawals, "money"),
        metric("Trades placed", current.trades, previous.trades, "count"),
        metric("Real trades staked", current.staked, previous.staked, "money"),
        metric("House result", current.housePnl, previous.housePnl, "money"),
        metric("Real wins", current.wins, previous.wins, "count"),
        metric("Real losses", current.losses, previous.losses, "count"),
      ],
    };
  });

export const searchClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string }) => ({
    query: String(input?.query ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context as unknown as AuthContext);
    let builder = db
      .from("profiles")
      .select("id, client_id, email, full_name, first_name, last_name, country, phone, kyc_status, live_balance, created_at, last_seen_at")
      .order("created_at", { ascending: false })
      .limit(40);

    if (data.query.length > 0) {
      const safe = data.query.replace(/[%,()]/g, "");
      builder = builder.or(
        [
          `client_id.ilike.%${safe}%`,
          `email.ilike.%${safe}%`,
          `full_name.ilike.%${safe}%`,
          `first_name.ilike.%${safe}%`,
          `last_name.ilike.%${safe}%`,
          `phone.ilike.%${safe}%`,
        ].join(","),
      );
    }

    const { data: rows, error } = await builder;
    if (error) throw new Error("Could not load clients.");
    return { clients: rows ?? [] };
  });

export const getClientDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId?: string }) => ({
    clientId: String(input?.clientId ?? "").trim().slice(0, 40),
  }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context as unknown as AuthContext);
    if (!data.clientId) throw new Error("Client not found.");

    const { data: profile } = await db
      .from("profiles")
      .select("*")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!profile) throw new Error("Client not found.");

    const [txRes, tradesRes, loginsRes, withdrawalsRes] = await Promise.all([
      db
        .from("transactions")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("trades")
        .select("id, symbol, direction, stake, pnl, status, account_mode, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("login_events")
        .select("created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .from("withdrawal_requests")
        .select("id, amount_usdt, phone, status, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const transactions = txRes.data ?? [];
    const liveTx = transactions.filter((t) => t.account_mode === "live");
    const trades = tradesRes.data ?? [];
    const liveTrades = trades.filter((t) => t.account_mode === "live");

    return {
      profile,
      totals: {
        deposited: liveTx
          .filter((t) => t.kind === "deposit" && t.status === "completed")
          .reduce((sum, t) => sum + Number(t.amount), 0),
        withdrawn: liveTx
          .filter((t) => t.kind === "withdrawal" && t.status !== "failed")
          .reduce((sum, t) => sum + Number(t.amount), 0),
        trades: liveTrades.length,
        staked: liveTrades.reduce((sum, t) => sum + Number(t.stake), 0),
        traderPnl: liveTrades
          .filter((t) => t.status !== "open")
          .reduce((sum, t) => sum + Number(t.pnl), 0),
      },
      transactions,
      trades,
      withdrawals: withdrawalsRes.data ?? [],
      lastLogins: (loginsRes.data ?? []).map((l) => l.created_at),
    };
  });
