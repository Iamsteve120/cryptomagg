import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/market-widgets";
import { useAccount } from "@/hooks/use-trading";
import { resetDemoAccount, updateDisplayName } from "@/lib/trading.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/assets";
import { useAccountMode } from "@/components/account-mode";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — CryptoMagg" },
      {
        name: "description",
        content: "Manage your CryptoMagg display name and reset your demo trading balance.",
      },
      { property: "og:title", content: "Profile — CryptoMagg" },
      { property: "og:description", content: "Manage your demo trading account." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { mode } = useAccountMode();
  const { data } = useAccount();
  const queryClient = useQueryClient();
  const router = useRouter();
  const saveName = useServerFn(updateDisplayName);
  const resetAccount = useServerFn(resetDemoAccount);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (data?.profile?.full_name) setFullName(data.profile.full_name);
  }, [data?.profile?.full_name]);

  const nameMutation = useMutation({
    mutationFn: () => saveName({ data: { fullName } }),
    onSuccess: () => {
      toast.success("Display name updated.");
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save your name."),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetAccount({ data: undefined }),
    onSuccess: () => {
      toast.success("Demo account reset to $10,000.");
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: () => toast.error("Could not reset the demo account."),
  });

  const stats = data?.stats;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "demo" ? "Manage your practice account." : "Your Live account is awaiting verification."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={mode === "demo" ? "Demo balance" : "Live balance"}
          value={data?.profile ? (mode === "demo" ? "$" + formatMoney(Number(data.profile.demo_balance)) : formatMoney(Number(data.profile.live_balance)) + " USDT") : "—"}
          tone="positive"
        />
        <StatCard label="Settled trades" value={stats ? String(stats.totalTrades) : "—"} />
        <StatCard label="Win rate" value={stats ? stats.winRate + "%" : "—"} />
      </div>

      <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={data?.profile?.email ?? ""} readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <Button
          onClick={() => nameMutation.mutate()}
          disabled={nameMutation.isPending || fullName.trim().length === 0}
        >
          Save changes
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <div>
          <p className="font-semibold">Reset demo account</p>
          <p className="text-sm text-muted-foreground">
            Clears all simulated trades and wallet activity, and restores your $10,000 demo balance.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
        >
          Reset to $10,000
        </Button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="font-semibold">Session</p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={async () => {
            await supabase.auth.signOut();
            router.navigate({ to: "/auth" });
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
