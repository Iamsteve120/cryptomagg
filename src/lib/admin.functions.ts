import { createServerFn } from "@tanstack/react-start";

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

/**
 * Fresh-start line for the operations console. Everything recorded before this
 * moment is treated as pre launch noise and is never shown or counted, so the
 * console starts empty and fills up again from the next sign up onwards.
 */
export const CONSOLE_EPOCH = "2026-09-21T22:54:00.000Z";

/** Fallback shilling rate used only when no recorded deposit rate exists. */
const FALLBACK_USD_KES = 129;

const RANGE_KEYS = Object.keys(ADMIN_RANGES) as AdminRangeKey[];

function normaliseRange(value: unknown): AdminRangeKey {
  return RANGE_KEYS.includes(value as AdminRangeKey) ? (value as AdminRangeKey) : "1d";
}

/**
 * Every admin read is gated on the encrypted admin portal session cookie, which
 * is only issued after the separate username and password check on the server.
 */
async function requireAdmin() {
  const { requireAdminSession } = await import("./admin-portal.server");
  return requireAdminSession();
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export const getAdminOverview = createServerFn({ method: "POST" })
  .inputValidator((input: { range?: string }) => ({ range: normaliseRange(input?.range) }))
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    const minutes = ADMIN_RANGES[data.range].minutes;
    const now = Date.now();
    const windowMs = minutes * 60_000;
    const startIso = new Date(now - windowMs).toISOString();
    const prevIso = new Date(now - windowMs * 2).toISOString();
    const onlineIso = new Date(now - 5 * 60_000).toISOString();

    const sinceIso = prevIso > CONSOLE_EPOCH ? prevIso : CONSOLE_EPOCH;

    const [profilesRes, txRes, tradesRes, loginsRes, rateRes] = await Promise.all([
      db
        .from("profiles")
        .select("id, created_at, last_seen_at, live_balance, demo_balance")
        .gte("created_at", CONSOLE_EPOCH),
      db
        .from("transactions")
        .select("user_id, kind, amount, status, account_mode, created_at")
        .eq("account_mode", "live")
        .gte("created_at", sinceIso),
      // Real money activity only. Practice trades are never counted here.
      db
        .from("trades")
        .select("user_id, stake, status, pnl, account_mode, created_at")
        .eq("account_mode", "live")
        .gte("created_at", sinceIso),
      db.from("login_events").select("user_id, created_at").gte("created_at", sinceIso),
      db.from("deposit_intents").select("usd_kes_rate").order("created_at", { ascending: false }).limit(1),
    ]);

    const profiles = profilesRes.data ?? [];
    const transactions = txRes.data ?? [];
    const trades = tradesRes.data ?? [];
    const logins = loginsRes.data ?? [];
    const recordedRate = Number(rateRes.data?.[0]?.usd_kes_rate);
    const usdKes = Number.isFinite(recordedRate) && recordedRate > 0 ? recordedRate : FALLBACK_USD_KES;

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
      const liveTx = transactions.filter((t) => inWindow(t.created_at, from, to));
      const deposits = liveTx
        .filter((t) => t.kind === "deposit" && t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const withdrawals = liveTx
        .filter((t) => t.kind === "withdrawal" && t.status !== "failed")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const liveTrades = trades.filter((t) => inWindow(t.created_at, from, to));
      const staked = liveTrades.reduce((sum, t) => sum + Number(t.stake), 0);
      const settled = liveTrades.filter((t) => t.status !== "open");
      const traderPnl = settled.reduce((sum, t) => sum + Number(t.pnl), 0);
      // What clients actually lost on the market, real accounts only.
      const lostUsd = settled
        .filter((t) => Number(t.pnl) < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.pnl)), 0);
      return {
        signups,
        active: activeIds.size,
        deposits,
        withdrawals,
        trades: liveTrades.length,
        liveTrades: liveTrades.length,
        staked,
        lostUsd,
        wins: liveTrades.filter((t) => t.status === "won").length,
        losses: liveTrades.filter((t) => t.status === "lost").length,
        housePnl: -traderPnl,
      };
    }

    const current = bucket(startIso);
    const previous = bucket(prevIso, startIso);

    const totalClients = profiles.length;
    void onlineIso;

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
      usdKesRate: usdKes,
      marketLosses: {
        usd: current.lostUsd,
        kes: current.lostUsd * usdKes,
        deltaPct: pct(current.lostUsd, previous.lostUsd),
      },
      headline: [
        { label: "Total clients", value: totalClients, kind: "count" as const, deltaPct: null },
        { label: "Client balances held", value: liveFloat, kind: "money" as const, deltaPct: null },
        { label: "Real trades", value: trades.length, kind: "count" as const, deltaPct: null },
      ],
      metrics: [
        metric("Deposited", current.deposits, previous.deposits, "money"),
        metric("Withdrawn", current.withdrawals, previous.withdrawals, "money"),
        metric("Real trades placed", current.trades, previous.trades, "count"),
        metric("Real trades staked", current.staked, previous.staked, "money"),
        metric("House result", current.housePnl, previous.housePnl, "money"),
        metric("Real wins", current.wins, previous.wins, "count"),
        metric("Real losses", current.losses, previous.losses, "count"),
      ],
    };
  });

/**
 * Rolling activity log for the console. Real account activity only: trades,
 * money in, money out, payout replies and sign ins, newest first.
 */
export const getAdminActivityLog = createServerFn({ method: "POST" })
  .inputValidator((input: { limit?: number }) => ({
    limit: Math.min(Math.max(Number(input?.limit ?? 60), 10), 150),
  }))
  .handler(async ({ data }) => {
    const db = await requireAdmin();

    const [tradesRes, txRes, withdrawalsRes, intentsRes, loginsRes] = await Promise.all([
      db
        .from("trades")
        .select("id, user_id, symbol, direction, stake, pnl, status, created_at")
        .eq("account_mode", "live")
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(data.limit),
      db
        .from("transactions")
        .select("id, user_id, kind, method, amount, status, created_at")
        .eq("account_mode", "live")
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(data.limit),
      db
        .from("withdrawal_requests")
        .select("id, user_id, amount_usdt, phone, status, provider_receipt, failure_reason, created_at")
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(data.limit),
      db
        .from("deposit_intents")
        .select("id, user_id, amount_usdt, amount_kes, status, provider_receipt, created_at")
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(data.limit),
      db
        .from("login_events")
        .select("id, user_id, kind, created_at")
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(data.limit),
    ]);

    const userIds = new Set<string>();
    for (const row of [
      ...(tradesRes.data ?? []),
      ...(txRes.data ?? []),
      ...(withdrawalsRes.data ?? []),
      ...(intentsRes.data ?? []),
      ...(loginsRes.data ?? []),
    ]) {
      userIds.add(row.user_id);
    }

    const labels = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: owners } = await db
        .from("profiles")
        .select("id, client_id, email")
        .in("id", Array.from(userIds));
      for (const owner of owners ?? []) {
        labels.set(owner.id, owner.client_id ?? owner.email ?? "client");
      }
    }

    const who = (id: string) => labels.get(id) ?? "client";

    const events: {
      id: string;
      at: string;
      kind: "trade" | "money" | "withdrawal" | "deposit" | "login";
      client: string;
      text: string;
      amountUsd: number | null;
    }[] = [];

    for (const t of tradesRes.data ?? []) {
      events.push({
        id: `trade-${t.id}`,
        at: t.created_at,
        kind: "trade",
        client: who(t.user_id),
        text: `Real trade ${t.symbol} ${t.direction} · ${t.status}`,
        amountUsd: t.status === "open" ? Number(t.stake) : Number(t.pnl),
      });
    }
    for (const t of txRes.data ?? []) {
      events.push({
        id: `tx-${t.id}`,
        at: t.created_at,
        kind: "money",
        client: who(t.user_id),
        text: `${t.kind} · ${t.method} · ${t.status}`,
        amountUsd: Number(t.amount),
      });
    }
    for (const w of withdrawalsRes.data ?? []) {
      events.push({
        id: `wd-${w.id}`,
        at: w.created_at,
        kind: "withdrawal",
        client: who(w.user_id),
        text: `Withdrawal ${w.status} · ${w.phone}${
          w.provider_receipt ? ` · M Pesa code ${w.provider_receipt}` : ""
        }${w.failure_reason ? ` · ${w.failure_reason}` : ""}`,
        amountUsd: Number(w.amount_usdt),
      });
    }
    for (const d of intentsRes.data ?? []) {
      events.push({
        id: `dep-${d.id}`,
        at: d.created_at,
        kind: "deposit",
        client: who(d.user_id),
        text: `M Pesa deposit ${d.status}${
          d.provider_receipt ? ` · M Pesa code ${d.provider_receipt}` : ""
        } · ${Number(d.amount_kes).toFixed(0)} KES`,
        amountUsd: Number(d.amount_usdt),
      });
    }
    for (const l of loginsRes.data ?? []) {
      events.push({
        id: `login-${l.id}`,
        at: l.created_at,
        kind: "login",
        client: who(l.user_id),
        text: `Signed in (${l.kind})`,
        amountUsd: null,
      });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return { events: events.slice(0, data.limit), generatedAt: new Date().toISOString() };
  });

export const searchClients = createServerFn({ method: "POST" })
  .inputValidator((input: { query?: string }) => ({
    query: String(input?.query ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    let builder = db
      .from("profiles")
      .select("id, client_id, email, full_name, first_name, last_name, country, phone, kyc_status, live_balance, created_at, last_seen_at")
      .gte("created_at", CONSOLE_EPOCH)
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
    const clients = rows ?? [];
    if (clients.length === 0) return { clients: [] };

    // M Pesa money in per client: confirmed STK push deposits with their receipt codes.
    const { data: intents } = await db
      .from("deposit_intents")
      .select("user_id, amount_usdt, amount_kes, provider_receipt, status, created_at")
      .in(
        "user_id",
        clients.map((c) => c.id),
      )
      .order("created_at", { ascending: false });

    const summary = new Map<string, { amount: number; amountKes: number; codes: string[] }>();
    for (const intent of intents ?? []) {
      if (intent.status !== "completed") continue;
      const entry = summary.get(intent.user_id) ?? { amount: 0, amountKes: 0, codes: [] };
      entry.amount += Number(intent.amount_usdt);
      entry.amountKes += Number(intent.amount_kes);
      if (intent.provider_receipt) entry.codes.push(intent.provider_receipt);
      summary.set(intent.user_id, entry);
    }

    return {
      clients: clients.map((c) => {
        const entry = summary.get(c.id);
        return {
          ...c,
          mpesaAmount: entry?.amount ?? 0,
          mpesaAmountKes: entry?.amountKes ?? 0,
          mpesaCodes: entry?.codes.slice(0, 3) ?? [],
        };
      }),
    };
  });

export const getClientDetail = createServerFn({ method: "POST" })
  .inputValidator((input: { clientId?: string }) => ({
    clientId: String(input?.clientId ?? "").trim().slice(0, 40),
  }))
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    if (!data.clientId) throw new Error("Client not found.");

    const { data: profile } = await db
      .from("profiles")
      .select("*")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!profile) throw new Error("Client not found.");

    const [txRes, tradesRes, loginsRes, withdrawalsRes, intentsRes, rateRes] = await Promise.all([
      db
        .from("transactions")
        .select("*")
        .eq("user_id", profile.id)
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("trades")
        .select("id, symbol, direction, stake, pnl, status, account_mode, created_at")
        .eq("user_id", profile.id)
        .eq("account_mode", "live")
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("login_events")
        .select("created_at")
        .eq("user_id", profile.id)
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .from("withdrawal_requests")
        .select("id, amount_usdt, phone, status, provider_receipt, failure_reason, created_at")
        .eq("user_id", profile.id)
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("deposit_intents")
        .select(
          "id, amount_usdt, amount_kes, usd_kes_rate, phone, status, provider_receipt, failure_reason, created_at",
        )
        .eq("user_id", profile.id)
        .gte("created_at", CONSOLE_EPOCH)
        .order("created_at", { ascending: false })
        .limit(20),
      // Latest recorded shilling rate, used to show payouts in KES as well as USDT.
      db
        .from("deposit_intents")
        .select("usd_kes_rate")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const recordedRate = Number(rateRes.data?.[0]?.usd_kes_rate);
    const usdKes = Number.isFinite(recordedRate) && recordedRate > 0 ? recordedRate : FALLBACK_USD_KES;

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
      usdKesRate: usdKes,
      withdrawals: (withdrawalsRes.data ?? []).map((w) => ({
        ...w,
        amount_kes: Number(w.amount_usdt) * usdKes,
      })),
      mpesaDeposits: intentsRes.data ?? [],
      lastLogins: (loginsRes.data ?? []).map((l) => l.created_at),
    };
  });

export const getClientKycLinks = createServerFn({ method: "POST" })
  .inputValidator((input: { clientId?: string }) => ({
    clientId: String(input?.clientId ?? "").trim().slice(0, 40),
  }))
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    const { data: profile } = await db
      .from("profiles")
      .select("kyc_doc_front_path, kyc_doc_back_path")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!profile) throw new Error("Client not found.");
    const paths = [profile.kyc_doc_front_path, profile.kyc_doc_back_path].filter(
      (path): path is string => Boolean(path),
    );
    if (paths.length === 0) return { documents: [] };
    const { data: signed, error } = await db.storage.from("kyc-documents").createSignedUrls(paths, 120);
    if (error) throw new Error("Documents could not be opened.");
    return {
      documents: (signed ?? []).map((item, index) => ({
        side: index === 0 ? "Front" : "Back",
        url: item.signedUrl,
      })),
    };
  });
