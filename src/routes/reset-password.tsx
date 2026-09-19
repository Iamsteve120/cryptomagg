import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password | CryptoMagg" },
      {
        name: "description",
        content: "Choose a new password for your CryptoMagg account.",
      },
      { property: "og:title", content: "Set a new password | CryptoMagg" },
      { property: "og:description", content: "Choose a new password for your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Your password has been updated.");
      router.navigate({ to: "/dashboard" });
    } catch {
      toast.error("That reset link is no longer valid. Please request a new one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-glow flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full min-w-0 max-w-md rounded-2xl border border-border/70 bg-card/90 p-5 shadow-2xl sm:p-8">
        <div className="flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <h1 className="mt-6 text-xl font-semibold sm:text-2xl">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open this page from the link in your email, then choose a new password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Updating" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
