import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { COUNTRIES } from "@/lib/countries";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | CryptoMagg" },
      {
        name: "description",
        content:
          "Sign in to CryptoMagg or open an account to fund by M-Pesa and trade the crypto markets.",
      },
      { property: "og:title", content: "Sign in | CryptoMagg" },
      {
        property: "og:description",
        content: "Sign in to CryptoMagg or open a new trading account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function normalisePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits.slice(0, 12);
  if (digits.startsWith("0")) return ("254" + digits.slice(1)).slice(0, 12);
  if (digits.startsWith("7") || digits.startsWith("1")) return ("254" + digits).slice(0, 12);
  return digits.slice(0, 15);
}

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("Kenya");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("If that email has an account, a reset link is on its way.");
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
          toast.error("The two email addresses do not match.");
          return;
        }
        if (firstName.trim().length < 2 || lastName.trim().length < 2) {
          toast.error("Please enter your first and second name.");
          return;
        }
        const cleanPhone = normalisePhone(phone);
        if (cleanPhone.length < 10) {
          toast.error("Enter a valid mobile phone number.");
          return;
        }
        if (!acceptTerms || !confirmAge) {
          toast.error("Please accept the terms and confirm you are over 18.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin + "/verify",
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: `${firstName.trim()} ${lastName.trim()}`,
              country,
              phone: cleanPhone,
              terms_accepted: true,
              age_confirmed: true,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your address, then sign in to upload your ID.");
          setMode("signin");
        } else {
          router.navigate({ to: "/verify" });
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("That sign in did not work. Please try again.");
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen">
      <div className="grid-glow flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full min-w-0 max-w-md rounded-2xl border border-border/70 bg-card/90 p-5 shadow-2xl backdrop-blur sm:p-8">
          <Link to="/" className="flex items-center justify-center">
            <BrandLogo size="lg" />
          </Link>

          <h1 className="mt-6 text-xl font-semibold sm:text-2xl">
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
                ? "Open your account"
                : "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "Enter your email and we will send you a reset link."
              : mode === "signup"
                ? "A few details, then one identity document to finish."
                : "Sign in to trade, fund your account and withdraw."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="lastName">Second name</Label>
                    <Input
                      id="lastName"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {COUNTRIES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile phone number</Label>
                  <Input
                    id="phone"
                    required
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                    autoComplete="tel"
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {mode === "signup" ? (
              <div className="space-y-2">
                <Label htmlFor="confirmEmail">Confirm email</Label>
                <Input
                  id="confirmEmail"
                  type="email"
                  required
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            ) : null}

            {mode !== "forgot" ? (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>
            ) : null}

            {mode === "signup" ? (
              <div className="space-y-2 rounded-lg border border-border/70 p-3">
                <label className="flex items-start gap-2 text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span className="min-w-0">
                    I have read and accept the terms and conditions of CryptoMagg, and I understand
                    that crypto trading carries a high level of risk.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0"
                    checked={confirmAge}
                    onChange={(e) => setConfirmAge(e.target.checked)}
                  />
                  <span className="min-w-0">I confirm that I am 18 years of age or older.</span>
                </label>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>

          {mode === "signin" ? (
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMode("forgot")}
            >
              Forgot your password?
            </button>
          ) : null}

          {mode !== "forgot" ? (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or{" "}
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuth("google")}
                  disabled={busy}
                >
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuth("apple")}
                  disabled={busy}
                >
                  Continue with Apple
                </Button>
              </div>
            </>
          ) : null}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to CryptoMagg?"}{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
