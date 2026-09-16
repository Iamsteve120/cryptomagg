import { createOpenAI } from "@ai-sdk/openai";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createScannerAi(lovableApiKey: string, initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  const wrappedFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Lovable-API-Key", lovableApiKey);
    headers.set("X-Lovable-AIG-SDK", "vercel-ai-sdk");
    if (runId) headers.set(RUN_ID_HEADER, runId);
    const response = await fetch(input, { ...init, headers });
    runId = response.headers.get(RUN_ID_HEADER)?.trim() || runId;
    return response;
  };

  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: lovableApiKey,
    fetch: wrappedFetch,
  });
}