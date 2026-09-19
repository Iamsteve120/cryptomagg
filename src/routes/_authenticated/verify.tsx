import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { submitKyc } from "@/lib/onboarding.functions";
import { useAccount } from "@/hooks/use-trading";

export const Route = createFileRoute("/_authenticated/verify")({
  head: () => ({
    meta: [
      { title: "Verify your identity | CryptoMagg" },
      {
        name: "description",
        content: "Upload a national ID, driver's licence or passport to finish setting up your CryptoMagg account.",
      },
      { property: "og:title", content: "Verify your identity | CryptoMagg" },
      { property: "og:description", content: "Finish setting up your CryptoMagg account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyPage,
});

const DOC_TYPES = [
  { value: "national_id", label: "National ID" },
  { value: "drivers_licence", label: "Driver's licence" },
  { value: "passport", label: "Passport" },
] as const;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024;

function VerifyPage() {
  const { data } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const save = useServerFn(submitKyc);
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]["value"]>("national_id");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const status = data?.profile?.kyc_status ?? "not_submitted";
  const clientId = data?.profile?.client_id ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Upload a JPG, PNG, WEBP or PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That file is too large. Keep it under 8 MB.");
      return;
    }
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error("Please sign in again.");
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/${docType}-${Date.now()}.${extension}`;
      const upload = await supabase.storage
        .from("kyc-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error("We could not upload that document. Please try again.");
      await save({ data: { docType, storagePath: path } });
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      toast.success("Document received. Welcome to CryptoMagg.");
      router.navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg space-y-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold sm:text-2xl">Verify your identity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One document finishes your account setup. It is stored privately and only our team can see it.
        </p>
        {clientId ? (
          <p className="num mt-2 text-sm">
            Your client ID: <span className="font-semibold text-primary">{clientId}</span>
          </p>
        ) : null}
      </div>

      {status === "submitted" || status === "approved" ? (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <p className="font-semibold text-primary">Document received</p>
          <p className="mt-1 text-muted-foreground">
            Your identity document is on file. You can upload a replacement below if anything changed.
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="docType">Document type</Label>
          <select
            id="docType"
            value={docType}
            onChange={(e) => setDocType(e.target.value as typeof docType)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="docFile">Upload document</Label>
          <input
            id="docFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          <p className="text-xs text-muted-foreground">JPG, PNG, WEBP or PDF, up to 8 MB.</p>
        </div>

        <Button type="submit" className="w-full" disabled={busy || !file}>
          {busy ? "Uploading" : "Submit document"}
        </Button>
      </form>
    </div>
  );
}
