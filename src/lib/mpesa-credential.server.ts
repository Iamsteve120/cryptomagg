/**
 * Builds the Safaricom B2C SecurityCredential by encrypting the operator's
 * plain password with Safaricom's production public key (RSA, PKCS#1 v1.5).
 * Server only — the plain password never leaves the server.
 *
 * The public key below is the one Safaricom distributes for production Daraja
 * B2C credential encryption (CN=apigee.apicaller.safaricom.co.ke). Safaricom
 * validates the ciphertext against this key regardless of the certificate's
 * printed validity window, so the key material is what matters.
 */
import { createPublicKey, publicEncrypt, constants } from "node:crypto";

// 2048-bit RSA modulus (hex) from Safaricom's production certificate.
const MODULUS_HEX =
  "A249C86F94E6D61C4E55D16C39E8C0B3ABDE01A8B7D99BF8E3604BB8E1A414A51E094336B342BC5C4B14B7A04FDB9AD018D95309312A7DDB51AF29BA6EDE64D1F4C3B1C7F4C8C0A86336B14E1D667A383CACF3BA6C3F0C241D1C15645478B1325A331E10FB18552245BFB4F9F087409FBFD1864AE9065D5D4FB4A62197CD5642250F7E7E0B181A6FEBBBF9CEDD1E1EA65A0B8412813735B57B5E397AD336C3FC1BAF9AEEA2F44633FB6EE33553C8EA94571EFA7E6A32334D2B22783F19B73D5EA02F66A6112B6AC006A4C6D1D6C6DAF5B33A863C38B724D69C90F3ED17504269EC5B535F15D61D2B4A8344A517ED21BAAD0901A95867745BDEE120C546AEB0BD";

function productionPublicKey() {
  const n = Buffer.from(MODULUS_HEX, "hex").toString("base64url");
  return createPublicKey({
    key: { kty: "RSA", n, e: "AQAB" },
    format: "jwk",
  });
}

export function buildSecurityCredential(plainPassword: string): string {
  const password = plainPassword.trim();
  if (!password) throw new Error("mpesa_payout_not_configured");
  const encrypted = publicEncrypt(
    { key: productionPublicKey(), padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(password, "utf8"),
  );
  return encrypted.toString("base64");
}
