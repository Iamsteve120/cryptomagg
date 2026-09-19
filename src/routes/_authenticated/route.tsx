import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/app-nav";
import { DemoFooter } from "@/components/demo-banner";
import { useAccount } from "@/hooks/use-trading";
import { AccountModeProvider } from "@/components/account-mode";
import { recordActivity } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const location = useLocation();
  const { data } = useAccount();
  const demoBalance = data?.profile ? Number(data.profile.demo_balance) : null;
  const liveBalance = data?.profile ? Number(data.profile.live_balance) : null;
  const ping = useServerFn(recordActivity);
  const focusedOnboarding = location.pathname === "/verify";

  useEffect(() => {
    void ping({ data: { kind: "session" } }).catch(() => {});
    const timer = setInterval(() => {
      void ping({ data: { kind: "heartbeat" } }).catch(() => {});
    }, 300_000);
    return () => clearInterval(timer);
  }, [ping]);

  return (
    <AccountModeProvider>
      <div className={focusedOnboarding ? "min-h-screen overflow-x-hidden" : "app-shell min-h-screen overflow-x-hidden"}>
        {!focusedOnboarding ? <AppNav demoBalance={demoBalance} liveBalance={liveBalance} /> : null}
        <main className="mx-auto w-full min-w-0 max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
          <Outlet />
        </main>
        {!focusedOnboarding ? <DemoFooter /> : null}
      </div>
    </AccountModeProvider>
  );
}

