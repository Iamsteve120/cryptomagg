import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { LineChart, Wallet, History, User, LayoutDashboard, LogOut, Menu, Zap } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useAccountMode } from "@/components/account-mode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/assets";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/trade", label: "Trade", icon: Zap },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/history", label: "History", icon: History },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppNav({ demoBalance, liveBalance }: { demoBalance: number | null; liveBalance: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { mode, setMode } = useAccountMode();
  const balance = mode === "demo" ? demoBalance : liveBalance;

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link to="/dashboard" className="flex items-center">
          <BrandLogo size="sm" className="shrink-0" />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
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

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden rounded-md border border-border bg-secondary/40 p-1 sm:flex" aria-label="Account type">
            <Button size="sm" variant={mode === "demo" ? "secondary" : "ghost"} onClick={() => setMode("demo")}>Demo</Button>
            <Button size="sm" variant={mode === "live" ? "default" : "ghost"} onClick={() => setMode("live")}>Real</Button>
          </div>
          <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-right">
            <p className="text-[10px] uppercase tracking-wider text-primary/80">{mode === "demo" ? "Demo USD" : "Real USDT"}</p>
            <p className="num text-sm font-semibold text-primary">
              {balance === null ? "—" : mode === "demo" ? "$" + formatMoney(balance) : formatMoney(balance) + " USDT"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </div>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 grid grid-cols-6 gap-1 border-t border-border bg-background px-2 py-2 lg:hidden",
          open ? "grid" : "hidden",
        )}
      >
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-accent text-accent-foreground" }}
            className="flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-medium text-muted-foreground"
          >
            <l.icon className="size-4" />
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
