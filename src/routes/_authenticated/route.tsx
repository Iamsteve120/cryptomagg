import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/app-nav";
import { DemoFooter } from "@/components/demo-banner";
import { useAccount } from "@/hooks/use-trading";
import { AccountModeProvider } from "@/components/account-mode";

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
  const { data } = useAccount();
  const demoBalance = data?.profile ? Number(data.profile.demo_balance) : null;
  const liveBalance = data?.profile ? Number(data.profile.live_balance) : null;

  return (
    <AccountModeProvider>
      <div className="app-shell min-h-screen">
        <DemoBanner />
        <AppNav demoBalance={demoBalance} liveBalance={liveBalance} />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </main>
        <DemoFooter />
      </div>
    </AccountModeProvider>
  );
}
