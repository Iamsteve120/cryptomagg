/**
 * Reads Bitcoin transfers from the public network via mempool.space API.
 * This allows crediting deposits once they have at least one confirmation.
 */

const MEMPOOL_API = "https://mempool.space/api";

export type BtcVerification =
  | { ok: true; amountBtc: number }
  | { ok: false; reason: "not_found" | "not_confirmed" | "wrong_address" | "network_error" };

/**
 * Looks for a confirmed Bitcoin transfer with this transaction hash paid into
 * our receiving address.
 */
export async function verifyBtcTransfer(
  txHash: string,
  wantedAddress: string,
): Promise<BtcVerification> {
  const wanted = txHash.trim().toLowerCase();
  // Basic SHA-256 hash validation
  if (!/^[0-9a-f]{64}$/.test(wanted)) return { ok: false, reason: "not_found" };

  try {
    const response = await fetch(`${MEMPOOL_API}/tx/${wanted}`, {
      headers: { accept: "application/json" },
    });

    if (response.status === 404) return { ok: false, reason: "not_found" };
    if (!response.ok) return { ok: false, reason: "network_error" };

    const tx = await response.json();

    // Check if confirmed
    if (!tx.status?.confirmed) {
      return { ok: false, reason: "not_confirmed" };
    }

    // Sum up all outputs to our address in this transaction
    let amountSat = 0;
    if (Array.isArray(tx.vout)) {
      for (const output of tx.vout) {
        if (output.scriptpubkey_address === wantedAddress) {
          amountSat += Number(output.value || 0);
        }
      }
    }

    if (amountSat <= 0) {
      return { ok: false, reason: "wrong_address" };
    }

    return { ok: true, amountBtc: amountSat / 100_000_000 };
  } catch (error) {
    console.error("BTC verification failed", error);
    return { ok: false, reason: "network_error" };
  }
}
