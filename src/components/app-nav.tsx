import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { LineChart, Wallet, History, User, LayoutDashboard, LogOut, Menu, Zap } from "lucide-react";
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

export function AppNav({ balance }: { balance: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

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
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-right">
            <p className="text-[10px] uppercase tracking-wider text-primary/80">Demo balance</p>
            <p className="num text-sm font-semibold text-primary">
              {balance === null ? "—" : "$" + formatMoney(balance)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </div>

      <nav
        className={cn(
          "grid grid-cols-3 gap-1 border-t border-border/70 px-3 py-2 lg:hidden",
          open ? "grid" : "hidden",
        )}
      >
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-accent text-accent-foreground" }}
            className="flex flex-col items-center gap-1 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground"
          >
            <l.icon className="size-4" />
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
