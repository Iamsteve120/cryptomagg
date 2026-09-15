import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/app-nav";
import { DemoBanner, DemoFooter } from "@/components/demo-banner";
import { useAccount } from "@/hooks/use-trading";

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
  const balance = data?.profile ? Number(data.profile.demo_balance) : null;

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <AppNav balance={balance} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <DemoFooter />
    </div>
  );
}
