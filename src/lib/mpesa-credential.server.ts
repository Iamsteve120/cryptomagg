/** Validates a pre-encrypted Safaricom B2C security credential. Server only. */
export function buildSecurityCredential(configured: string): string {
  const value = configured.trim();
  if (!value) throw new Error("mpesa_payout_not_configured");
  // A 2048-bit RSA ciphertext is 344 Base64 characters. Never encrypt a plain
  // operator password with a bundled certificate: Safaricom rotates production
  // certificates, and a stale public key produces an invalid initiator request.
  if (value.length < 300 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("mpesa_security_credential_invalid");
  }
  return value;
}
