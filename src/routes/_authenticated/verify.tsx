import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, FileUp, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { completeKycProcessing, submitKyc } from "@/lib/onboarding.functions";
import { useAccount } from "@/hooks/use-trading";

export const Route = createFileRoute("/_authenticated/verify")({
  head: () => ({
    meta: [
      { title: "Verify your identity | CryptoMagg" },
      { name: "description", content: "Securely capture both sides of your identity document for CryptoMagg." },
      { property: "og:title", content: "Verify your identity | CryptoMagg" },
      { property: "og:description", content: "Finish setting up your CryptoMagg account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VerifyPage,
});

const DOC_TYPES = [
  { value: "national_id", label: "National ID" },
  { value: "drivers_licence", label: "Driver's licence" },
  { value: "passport", label: "Passport" },
] as const;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

function CaptureField({
  side,
  file,
  onChange,
}: {
  side: "Front" | "Back";
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const id = side.toLowerCase();

  function selectFile(next: File | undefined) {
    if (!next) return;
    if (!ACCEPTED.includes(next.type)) {
      toast.error("Choose a JPG, PNG or WEBP image.");
      return;
    }
    if (next.size > MAX_BYTES) {
      toast.error("That image is too large. Keep each side under 8 MB.");
      return;
    }
    onChange(next);
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3">
      <Label>{side} side</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => uploadRef.current?.click()}>
          <FileUp className="size-4" /> Upload file
        </Button>
        <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()}>
          <Camera className="size-4" /> Take photo
        </Button>
      </div>
      <input
        ref={uploadRef}
        id={`${id}-upload`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => selectFile(event.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        id={`${id}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => selectFile(event.target.files?.[0])}
      />
      <p className="truncate text-xs text-muted-foreground">
        {file ? file.name : `No ${side.toLowerCase()} image selected`}
      </p>
    </div>
  );
}

function VerifyPage() {
  const { data } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const save = useServerFn(submitKyc);
  const complete = useServerFn(completeKycProcessing);
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]["value"]>("national_id");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const profile = data?.profile;
  const status = profile?.kyc_status ?? "not_submitted";
  const clientId = profile?.client_id ?? null;

  useEffect(() => {
    if (status !== "processing" || secondsLeft !== null) return;
    const submittedAt = profile?.kyc_submitted_at ? new Date(profile.kyc_submitted_at).getTime() : Date.now();
    setSecondsLeft(Math.max(0, Math.ceil((29_000 - (Date.now() - submittedAt)) / 1000)));
  }, [profile?.kyc_submitted_at, secondsLeft, status]);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft > 0) {
      const timer = window.setTimeout(() => setSecondsLeft((value) => Math.max(0, (value ?? 1) - 1)), 1000);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    void complete()
      .then(async (result) => {
        if (cancelled) return;
        if (!result.approved) {
          setSecondsLeft(result.secondsLeft);
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["account"] });
        toast.success("Your document upload is approved.");
        router.navigate({ to: "/dashboard", replace: true });
      })
      .catch(() => {
        if (!cancelled) toast.error("The document check could not finish. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [complete, queryClient, router, secondsLeft]);

  async function uploadSide(file: File, side: "front" | "back", userId: string) {
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${docType}-${side}-${Date.now()}.${extension}`;
    const upload = await supabase.storage.from("kyc-documents").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) throw new Error(`We could not upload the ${side} image. Please try again.`);
    return path;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!frontFile || !backFile) {
      toast.error("Add both the front and back of your document.");
      return;
    }
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error("Please sign in again.");
      const [frontPath, backPath] = await Promise.all([
        uploadSide(frontFile, "front", userId),
        uploadSide(backFile, "back", userId),
      ]);
      const result = await save({ data: { docType, frontPath, backPath } });
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      setSecondsLeft(result.approvalDelaySeconds);
      toast.success("Both sides were received securely.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  if (status === "approved") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
        <div className="w-full rounded-lg border border-primary/40 bg-card p-6 text-center">
          <ShieldCheck className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 text-xl font-semibold">Upload approved</h1>
          <Button className="mt-5 w-full" onClick={() => router.navigate({ to: "/dashboard" })}>
            Continue to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-4">
        <BrandLogo size="md" />
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
          <LogOut className="size-4" />
        </Button>
      </header>

      {secondsLeft !== null || status === "processing" ? (
        <section className="rounded-lg border border-primary/40 bg-card p-6 text-center">
          <div className="num mx-auto grid size-20 place-items-center rounded-full border-4 border-primary text-2xl font-semibold text-primary">
            {secondsLeft ?? 29}s
          </div>
          <h1 className="mt-5 text-xl font-semibold">Checking your upload</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We are checking that both images were received and can be opened. This automated check does not authenticate the document with its issuer.
          </p>
        </section>
      ) : (
        <>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold sm:text-2xl">Verify your identity</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Add clear images of both sides. They stay private and are available only to authorised staff.
            </p>
            {clientId ? <p className="num mt-2 text-sm">Your client ID: <span className="font-semibold text-primary">{clientId}</span></p> : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="space-y-2">
              <Label htmlFor="docType">Document type</Label>
              <select
                id="docType"
                value={docType}
                onChange={(event) => {
                  setDocType(event.target.value as typeof docType);
                  setFrontFile(null);
                  setBackFile(null);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DOC_TYPES.map((document) => <option key={document.value} value={document.value}>{document.label}</option>)}
              </select>
            </div>

            <CaptureField side="Front" file={frontFile} onChange={setFrontFile} />
            <CaptureField side="Back" file={backFile} onChange={setBackFile} />
            <p className="text-xs leading-relaxed text-muted-foreground">JPG, PNG or WEBP, up to 8 MB per side. Use a clear, well-lit image with all edges visible.</p>
            <Button type="submit" className="w-full" disabled={busy || !frontFile || !backFile}>
              {busy ? "Uploading securely" : "Submit both sides"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}