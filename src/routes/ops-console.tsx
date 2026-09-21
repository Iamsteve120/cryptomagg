import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/assets";
import {
  ADMIN_RANGES,
  getAdminActivityLog,
  getAdminOverview,
  getClientDetail,
  searchClients,
  type AdminRangeKey,
} from "@/lib/admin.functions";
import {
  adminPortalLogin,
  adminPortalLogout,
  adminPortalStatus,
} from "@/lib/admin-portal.functions";
import {
  checkB2cCredential,
  getB2cDiagnostics,
  unblockB2cPayouts,
} from "@/lib/admin-b2c.functions";

export const Route = createFileRoute("/ops-console")({
  head: () => ({
    meta: [
      { title: "Operations console" },
      { name: "description", content: "Private operations console." },
      { property: "og:title", content: "Operations console" },
      { property: "og:description", content: "Private operations console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OpsConsolePage,
});

const RANGE_KEYS = Object.keys(ADMIN_RANGES) as AdminRangeKey[];

function formatValue(value: number, kind: "count" | "money") {
  if (kind === "money") return formatMoney(value) + " USDT";
  return new Intl.NumberFormat("en-US").format(value);
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] text-muted-foreground">new</span>;
  const up = value >= 0;
  return (
    <span className={cn("num text-[11px] font-semibold", up ? "text-primary" : "text-destructive")}>
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function OpsConsolePage() {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(adminPortalStatus);
  const status = useQuery({
    queryKey: ["admin-portal-status"],
    queryFn: () => statusFn(),
    staleTime: 60_000,
  });

  if (status.isLoading) {
    return <div className="min-h-dvh bg-background" />;
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-6 text-foreground">
      <div className="mx-auto w-full max-w-5xl min-w-0">
        {status.data?.signedIn ? (
          <Console onSignedOut={() => queryClient.invalidateQueries()} />
        ) : (
          <LoginCard onSignedIn={() => queryClient.invalidateQueries()} />
        )}
      </div>
    </div>
  );
}

function LoginCard({ onSignedIn }: { onSignedIn: () => void }) {
  const login = useServerFn(adminPortalLogin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await login({ data: { username, password } });
      if (res.ok) onSignedIn();
      else setError("Those details are not correct.");
    } catch {
      setError("Sign in is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-10 w-full max-w-sm space-y-4 rounded-xl border border-border/70 bg-card p-5"
    >
      <div>
        <p className="text-lg font-semibold">Operations console</p>
        <p className="mt-1 text-xs text-muted-foreground">Authorised staff only.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ops-user">Username</Label>
        <Input
          id="ops-user"
          value={username}
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ops-pass">Password</Label>
        <Input
          id="ops-pass"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}

function Console({ onSignedOut }: { onSignedOut: () => void }) {
  const [range, setRange] = useState<AdminRangeKey>("1d");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const overviewFn = useServerFn(getAdminOverview);
  const searchFn = useServerFn(searchClients);
  const detailFn = useServerFn(getClientDetail);
  const logoutFn = useServerFn(adminPortalLogout);

  const overview = useQuery({
    queryKey: ["admin-overview", range],
    queryFn: () => overviewFn({ data: { range } }),
    refetchInterval: 15_000,
  });

  const clients = useQuery({
    queryKey: ["admin-clients", query],
    queryFn: () => searchFn({ data: { query } }),
    refetchInterval: 30_000,
  });

  const detail = useQuery({
    queryKey: ["admin-client", selected],
    queryFn: () => detailFn({ data: { clientId: selected ?? "" } }),
    enabled: selected !== null,
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold sm:text-2xl">Operations console</h1>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            Clients, activity and money movement.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await logoutFn();
            onSignedOut();
          }}
        >
          Sign out
        </Button>
      </header>

      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-2">
          {RANGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                range === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {ADMIN_RANGES[key].label}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(overview.data?.headline ?? []).map((m) => (
          <div key={m.label} className="min-w-0 rounded-lg border border-border bg-card p-3">
            <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {m.label}
            </p>
            <p className="num mt-1 truncate text-base font-semibold sm:text-lg">
              {formatValue(m.value, m.kind)}
            </p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-2 rounded-xl border border-destructive/40 bg-card p-3 sm:grid-cols-2 sm:p-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Lost in the market · real accounts
          </p>
          <p className="num mt-1 truncate text-xl font-semibold text-destructive">
            {formatMoney(overview.data?.marketLosses.usd ?? 0)} USDT
          </p>
          <Delta value={overview.data?.marketLosses.deltaPct ?? null} />
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Same amount in shillings
          </p>
          <p className="num mt-1 truncate text-xl font-semibold">
            {formatMoney(overview.data?.marketLosses.kes ?? 0)} KES
          </p>
          <p className="num text-[11px] text-muted-foreground">
            1 USDT ≈ {formatMoney(overview.data?.usdKesRate ?? 0)} KES
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Last {ADMIN_RANGES[range].label} vs the {ADMIN_RANGES[range].label} before
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(overview.data?.metrics ?? []).map((m) => (
            <div key={m.label} className="min-w-0 rounded-lg border border-border bg-card p-3">
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.label}
              </p>
              <p className="num mt-1 truncate text-base font-semibold sm:text-lg">
                {formatValue(m.value, m.kind)}
              </p>
              <Delta value={m.deltaPct} />
            </div>
          ))}
          {overview.isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[76px] animate-pulse rounded-lg bg-muted/50" />
              ))
            : null}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border/70 bg-card p-3 sm:p-4">
        <div className="min-w-0">
          <p className="font-semibold">Clients</p>
          <p className="text-xs text-muted-foreground">
            Search by client ID, email, name or phone number.
          </p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="IDCW068202"
          inputMode="search"
        />

        <ul className="divide-y divide-border/60">
          {(clients.data?.clients ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c.client_id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="num block truncate text-sm font-semibold">
                    {c.client_id ?? "—"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                  <span className="num block truncate text-xs text-muted-foreground">
                    {c.phone ?? "No phone"}
                  </span>
                  <span className="num block truncate text-[11px] text-muted-foreground">
                    {c.mpesaCodes.length > 0 ? c.mpesaCodes.join(" · ") : "No M Pesa code"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block text-xs font-semibold text-primary">
                    {formatMoney(c.mpesaAmount)} USDT
                  </span>
                  <span className="num block text-[11px] text-muted-foreground">
                    M Pesa in · {formatMoney(c.mpesaAmountKes)} KES
                  </span>
                  <span className="num block text-[11px] text-muted-foreground">
                    Balance {formatMoney(Number(c.live_balance))} USDT
                  </span>
                </span>
              </button>
            </li>
          ))}
          {clients.data && clients.data.clients.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No matching clients.</li>
          ) : null}
        </ul>
      </section>

      {selected ? (
        <section className="space-y-3 rounded-xl border border-primary/40 bg-card p-3 sm:p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="num truncate font-semibold">{selected}</p>
              <p className="truncate text-xs text-muted-foreground">
                {detail.data?.profile.email ?? "Loading"}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>

          {detail.isError ? (
            <p className="text-sm text-destructive">That client could not be loaded.</p>
          ) : null}

          {detail.data ? (
            <>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                {[
                  [
                    "Full name",
                    detail.data.profile.full_name ??
                      ([detail.data.profile.first_name, detail.data.profile.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"),
                  ],
                  ["Country", detail.data.profile.country ?? "—"],
                  ["Phone", detail.data.profile.phone ?? "—"],
                  ["Verification", detail.data.profile.kyc_status],
                  ["Document", detail.data.profile.kyc_doc_type ?? "—"],
                  ["Over 18 confirmed", detail.data.profile.age_confirmed ? "Yes" : "No"],
                  ["Terms accepted", detail.data.profile.terms_accepted_at ? "Yes" : "No"],
                  ["Signed up", new Date(detail.data.profile.created_at).toLocaleString()],
                  [
                    "Last seen",
                    detail.data.profile.last_seen_at
                      ? new Date(detail.data.profile.last_seen_at).toLocaleString()
                      : "—",
                  ],
                  ["Real balance", formatMoney(Number(detail.data.profile.live_balance)) + " USDT"],
                  ["Demo balance", "$" + formatMoney(Number(detail.data.profile.demo_balance))],
                  ["Total deposited", formatMoney(detail.data.totals.deposited) + " USDT"],
                  ["Total withdrawn", formatMoney(detail.data.totals.withdrawn) + " USDT"],
                  ["Real trades", String(detail.data.totals.trades)],
                  ["Total staked", formatMoney(detail.data.totals.staked) + " USDT"],
                  ["Client result", formatMoney(detail.data.totals.traderPnl) + " USDT"],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-md border border-border/60 p-2">
                    <dt className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-0.5 break-words font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent funding
                </p>
                <ul className="mt-1 divide-y divide-border/60 text-xs">
                  {detail.data.transactions.slice(0, 10).map((t) => (
                    <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2">
                      <span className="min-w-0 truncate">
                        {t.kind} · {t.method} · {t.status}
                      </span>
                      <span className="num shrink-0 font-semibold">
                        {formatMoney(Number(t.amount))}
                      </span>
                    </li>
                  ))}
                  {detail.data.transactions.length === 0 ? (
                    <li className="py-2 text-muted-foreground">No funding activity.</li>
                  ) : null}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  M Pesa deposits
                </p>
                <ul className="mt-1 divide-y divide-border/60 text-xs">
                  {detail.data.mpesaDeposits.map((d) => (
                    <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2">
                      <span className="min-w-0">
                        <span className="block truncate">
                          {d.phone} · {d.status}
                          {d.provider_receipt ? ` · M Pesa code ${d.provider_receipt}` : ""}
                        </span>
                        <span className="block truncate text-muted-foreground">
                          {new Date(d.created_at).toLocaleString()} ·{" "}
                          {formatMoney(Number(d.amount_kes))} KES
                          {d.failure_reason ? ` · ${d.failure_reason}` : ""}
                        </span>
                      </span>
                      <span className="num shrink-0 font-semibold text-primary">
                        {formatMoney(Number(d.amount_usdt))} USDT
                      </span>
                    </li>
                  ))}
                  {detail.data.mpesaDeposits.length === 0 ? (
                    <li className="py-2 text-muted-foreground">No M Pesa deposits.</li>
                  ) : null}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  M Pesa withdrawals
                </p>
                <ul className="mt-1 divide-y divide-border/60 text-xs">
                  {detail.data.withdrawals.map((w) => (
                    <li key={w.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2">
                      <span className="min-w-0">
                        <span className="block truncate">
                          {w.phone} · {w.status}
                          {w.provider_receipt ? ` · ${w.provider_receipt}` : ""}
                        </span>
                        <span className="block truncate text-muted-foreground">
                          {new Date(w.created_at).toLocaleString()} ·{" "}
                          {formatMoney(Number(w.amount_kes))} KES
                          {w.provider_receipt ? ` · M Pesa code ${w.provider_receipt}` : ""}
                          {w.failure_reason ? ` · ${w.failure_reason}` : ""}
                        </span>
                      </span>
                      <span className="num shrink-0 font-semibold">
                        {formatMoney(Number(w.amount_usdt))} USDT
                      </span>
                    </li>
                  ))}
                  {detail.data.withdrawals.length === 0 ? (
                    <li className="py-2 text-muted-foreground">No withdrawals.</li>
                  ) : null}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent trades
                </p>
                <ul className="mt-1 divide-y divide-border/60 text-xs">
                  {detail.data.trades.slice(0, 10).map((t) => (
                    <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2">
                      <span className="min-w-0 truncate">
                        {t.symbol} · {t.direction} · {t.account_mode} · {t.status}
                      </span>
                      <span
                        className={cn(
                          "num shrink-0 font-semibold",
                          Number(t.pnl) >= 0 ? "text-primary" : "text-destructive",
                        )}
                      >
                        {formatMoney(Number(t.pnl))}
                      </span>
                    </li>
                  ))}
                  {detail.data.trades.length === 0 ? (
                    <li className="py-2 text-muted-foreground">No trades yet.</li>
                  ) : null}
                </ul>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <PayoutPanel />
    </div>
  );
}

function PayoutPanel() {
  const diagnosticsFn = useServerFn(getB2cDiagnostics);
  const checkFn = useServerFn(checkB2cCredential);
  const unblockFn = useServerFn(unblockB2cPayouts);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const diagnostics = useQuery({
    queryKey: ["admin-b2c"],
    queryFn: () => diagnosticsFn(),
    refetchInterval: 20_000,
  });

  const data = diagnostics.data;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">M Pesa payouts</p>
          <p className="truncate text-xs text-muted-foreground">
            {data
              ? data.configured
                ? "All payout details are present."
                : `Missing: ${data.missingSecrets.join(", ")}`
              : "Loading…"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await checkFn();
                setCheckResult(`${result.code} · ${result.description}`);
              } catch (error) {
                setCheckResult(error instanceof Error ? error.message : "Check failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Check details
          </Button>
          {data?.block.blocked ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await unblockFn();
                  await diagnostics.refetch();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Unblock
            </Button>
          ) : null}
        </div>
      </div>

      {checkResult ? (
        <p className="mt-2 break-words rounded bg-secondary p-2 text-xs">{checkResult}</p>
      ) : null}

      {data?.block.blocked ? (
        <p className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
          Payouts are paused ({data.block.code ?? "blocked"}) since{" "}
          {data.block.since ? new Date(data.block.since).toLocaleString() : "unknown"}.{" "}
          {data.block.detail ?? ""}
        </p>
      ) : null}

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p className="break-all">Result address: {data?.resultUrl ?? "—"}</p>
        <p className="break-all">Timeout address: {data?.timeoutUrl ?? "—"}</p>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Waiting on M Pesa
      </p>
      <ul className="mt-1 divide-y divide-border/60 text-xs">
        {(data?.pending ?? []).map((row) => (
          <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2">
            <span className="min-w-0 truncate">
              {row.phone} · {new Date(row.created_at).toLocaleString()}
            </span>
            <span className="num shrink-0 font-semibold">{formatMoney(Number(row.amount_usdt))}</span>
          </li>
        ))}
        {(data?.pending.length ?? 0) === 0 ? (
          <li className="py-2 text-muted-foreground">Nothing waiting.</li>
        ) : null}
      </ul>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Last 20 M Pesa replies
      </p>
      <ul className="mt-1 divide-y divide-border/60 text-xs">
        {(data?.events ?? []).map((event) => (
          <li key={event.id} className="py-2">
            <p className="text-muted-foreground">
              {new Date(event.created_at).toLocaleString()} · {event.kind} ·{" "}
              {event.result_code ?? "—"}
            </p>
            <p className="break-words">{event.result_desc ?? ""}</p>
          </li>
        ))}
        {(data?.events.length ?? 0) === 0 ? (
          <li className="py-2 text-muted-foreground">No replies yet.</li>
        ) : null}
      </ul>
    </section>
  );
}
