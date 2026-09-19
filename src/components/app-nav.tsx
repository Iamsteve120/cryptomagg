import { Link, useRouter } from "@tanstack/react-router";
import { LineChart, Wallet, History, User, LayoutDashboard, LogOut, CandlestickChart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BrandLogo } from "@/components/brand-logo";
import { useAccountMode } from "@/components/account-mode";
import { ThemeToggle } from "@/components/theme-mode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/assets";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/trade", label: "Trade", icon: CandlestickChart },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/history", label: "History", icon: History },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppNav({ demoBalance, liveBalance }: { demoBalance: number | null; liveBalance: number | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mode, setMode } = useAccountMode();
  const balance = mode === "demo" ? demoBalance : liveBalance;
  const navLinks = links;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }


  return (
    <header className="sticky top-0 z-[60] border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link to="/dashboard" className="flex items-center">
          <BrandLogo size="sm" withWordmark={false} className="shrink-0" />
          <span className="ml-2.5 hidden font-display text-lg font-bold leading-none text-foreground sm:inline">CryptoMagg</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <div className="flex rounded-md border border-border bg-secondary/40 p-1" aria-label="Account type">
            <Button size="sm" variant={mode === "demo" ? "secondary" : "ghost"} onClick={() => setMode("demo")}>Demo</Button>
            <Button size="sm" variant={mode === "live" ? "default" : "ghost"} onClick={() => setMode("live")}>Real</Button>
          </div>
          <div className="hidden rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-right sm:block">
            <p className="text-[10px] uppercase tracking-wider text-primary/80">{mode === "demo" ? "Demo USD" : "Real USDT"}</p>
            <p className="num text-sm font-semibold text-primary">
              {balance === null ? "Unavailable" : mode === "demo" ? "$" + formatMoney(balance) : formatMoney(balance) + " USDT"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-border bg-background px-2 py-2 lg:hidden">
        {navLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeProps={{ className: "bg-accent text-accent-foreground" }}
            className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-medium text-muted-foreground"
          >
            <l.icon className="size-4" />
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
