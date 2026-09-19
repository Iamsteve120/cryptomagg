import { createServerFn } from "@tanstack/react-start";

/** Every read and action here is gated on the operations console session. */
async function requireAdmin() {
  const { requireAdminSession } = await import("./admin-portal.server");
  return requireAdminSession();
}

/** Payout health: which secrets are missing, the block flag and recent callbacks. */
export const getB2cDiagnostics = createServerFn({ method: "GET" }).handler(async () => {
  const db = await requireAdmin();
  const { b2cConfigured, missingB2cSecrets, readB2cBlock, B2C_RESULT_URL, B2C_TIMEOUT_URL } =
    await import("./mpesa-b2c.server");

  const [{ data: events }, { data: pending }, block] = await Promise.all([
    db
      .from("b2c_callback_events")
      .select("id, kind, result_code, result_desc, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("withdrawal_requests")
      .select("id, amount_usdt, phone, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    readB2cBlock(),
  ]);

  return {
    configured: b2cConfigured(),
    missingSecrets: missingB2cSecrets(),
    resultUrl: B2C_RESULT_URL,
    timeoutUrl: B2C_TIMEOUT_URL,
    block,
    events: events ?? [],
    pending: pending ?? [],
  };
});

/** Verifies the initiator credential against Safaricom without moving money. */
export const checkB2cCredential = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { queryAccountBalance } = await import("./mpesa-b2c.server");
  return queryAccountBalance();
});

/** Clears the payout block after the operator credentials have been corrected. */
export const unblockB2cPayouts = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { clearB2cBlock } = await import("./mpesa-b2c.server");
  await clearB2cBlock();
  return { ok: true as const };
});
