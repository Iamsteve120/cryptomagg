/**
 * Reads USDT (TRC 20) transfers straight from the public Tron network so a
 * deposit is only credited when the chain confirms it. No keys are needed:
 * we only ever read.
 */

const TRONGRID = "https://api.trongrid.io";
/** Official Tether USDT contract on Tron. */
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

type Trc20Transfer = {
  transaction_id?: string;
  from?: string;
  to?: string;
  value?: string;
  block_timestamp?: number;
  token_info?: { decimals?: number; symbol?: string };
};

export type TronVerification =
  | { ok: true; amountUsdt: number; from: string }
  | { ok: false; reason: "not_found" | "wrong_address" | "network_error" };

/**
 * Looks for a confirmed USDT transfer with this transaction hash paid into one
 * of our receiving addresses.
 */
export async function verifyUsdtTransfer(
  txHash: string,
  addresses: readonly string[],
): Promise<TronVerification> {
  const wanted = txHash.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(wanted)) return { ok: false, reason: "not_found" };

  let sawTransaction = false;

  for (const address of addresses) {
    try {
      const url = `${TRONGRID}/v1/accounts/${address}/transactions/trc20?limit=200&only_to=true&contract_address=${USDT_CONTRACT}`;
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (!response.ok) return { ok: false, reason: "network_error" };
      const payload = (await response.json()) as { data?: Trc20Transfer[] };
      for (const row of payload.data ?? []) {
        if ((row.transaction_id ?? "").toLowerCase() !== wanted) continue;
        sawTransaction = true;
        if ((row.to ?? "") !== address) continue;
        const decimals = Number(row.token_info?.decimals ?? 6);
        const raw = Number(row.value ?? 0);
        if (!Number.isFinite(raw) || raw <= 0) continue;
        const amountUsdt = Math.floor((raw / 10 ** decimals) * 100) / 100;
        return { ok: true, amountUsdt, from: row.from ?? "" };
      }
    } catch {
      return { ok: false, reason: "network_error" };
    }
  }

  return { ok: false, reason: sawTransaction ? "wrong_address" : "not_found" };
}
