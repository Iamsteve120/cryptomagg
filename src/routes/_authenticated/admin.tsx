import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/assets";
import {
  ADMIN_RANGES,
  getAdminOverview,
  getClientDetail,
  searchClients,
  type AdminRangeKey,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin | CryptoMagg" },
      { name: "description", content: "Internal CryptoMagg client and activity overview." },
      { property: "og:title", content: "Admin | CryptoMagg" },
      { property: "og:description", content: "Internal client and activity overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
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
    <span
      className={cn(
        "num text-[11px] font-semibold",
        up ? "text-primary" : "text-destructive",
      )}
    >
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function AdminPage() {
  const [range, setRange] = useState<AdminRangeKey>("1d");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const overviewFn = useServerFn(getAdminOverview);
  const searchFn = useServerFn(searchClients);
  const detailFn = useServerFn(getClientDetail);

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

  if (overview.isError) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border/70 bg-card p-5 text-center">
        <p className="font-semibold">This area is restricted</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have access to the admin overview.
        </p>
        <Button asChild className="mt-4">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold sm:text-2xl">Admin overview</h1>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            Clients, activity and money movement.
          </p>
        </div>
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
                </span>
                <span className="num shrink-0 text-xs font-semibold text-primary">
                  {formatMoney(Number(c.live_balance))} USDT
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
                  ["Full name", detail.data.profile.full_name ?? ([detail.data.profile.first_name, detail.data.profile.last_name].filter(Boolean).join(" ") || "—")],
                  ["Country", detail.data.profile.country ?? "—"],
                  ["Phone", detail.data.profile.phone ?? "—"],
                  ["Verification", detail.data.profile.kyc_status],
                  ["Document", detail.data.profile.kyc_doc_type ?? "—"],
                  ["Over 18 confirmed", detail.data.profile.age_confirmed ? "Yes" : "No"],
                  ["Terms accepted", detail.data.profile.terms_accepted_at ? "Yes" : "No"],
                  ["Signed up", new Date(detail.data.profile.created_at).toLocaleString()],
                  ["Last seen", detail.data.profile.last_seen_at ? new Date(detail.data.profile.last_seen_at).toLocaleString() : "—"],
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
    </div>
  );
}
