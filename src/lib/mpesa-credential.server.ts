/**
 * Builds the M Pesa B2C security credential. Server only.
 *
 * Safaricom requires the API operator's password encrypted with their
 * production certificate's public key (RSA, PKCS#1 v1.5) and Base64 encoded.
 * A plain password is always rejected with "The initiator information is
 * invalid", so when only a short value is configured we encrypt it here.
 *
 * The public key below is the modulus/exponent of Safaricom's production
 * certificate (apigee.apicaller.safaricom.co.ke). It is public information.
 * RSA encryption is implemented with BigInt so it works in the edge runtime,
 * where node:crypto PKCS#1 encryption is not dependable.
 */

const MODULUS_HEX =
  "A249C86F94E6D61C4E55D16C39E8C0B3ABDE01A8B7D99BF8E3604BB8E1A414A51E094336B342BC5C4B14B7A04FDB9AD018D95309312A7DDB51AF29BA6EDE64D1F4C3B1C7F4C8C0A86336B14E1D667A383CACF3BA6C3F0C241D1C15645478B1325A331E10FB18552245BFB4F9F087409FBFD1864AE9065D5D4FB4A62197CD5642250F7E7E0B181A6FEBBBF9CEDD1E1EA65A0B8412813735B57B5E397AD336C3FC1BAF9AEEA2F44633FB6EE33553C8EA94571EFA7E6A32334D2B22783F19B73D5EA02F66A6112B6AC006A4C6D1D6C6DAF5B33A863C38B724D69C90F3ED17504269EC5B535F15D61D2B4A8344A517ED21BAAD0901A95867745BDEE120C546AEB0BD";
const PUBLIC_EXPONENT = 65537n;
const KEY_BYTES = 256;

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let remaining = value;
  for (let index = length - 1; index >= 0; index -= 1) {
    out[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

/** RSAES-PKCS1-v1_5 encryption of a short message with Safaricom's public key. */
function encryptPkcs1(message: Uint8Array): string {
  if (message.length > KEY_BYTES - 11) throw new Error("mpesa_credential_too_long");
  // EM = 0x00 || 0x02 || non-zero random padding || 0x00 || message
  const block = new Uint8Array(KEY_BYTES);
  block[0] = 0x00;
  block[1] = 0x02;
  const paddingLength = KEY_BYTES - message.length - 3;
  const random = new Uint8Array(paddingLength);
  crypto.getRandomValues(random);
  for (let index = 0; index < paddingLength; index += 1) {
    block[2 + index] = random[index] === 0 ? 1 + (index % 254) : (random[index] as number);
  }
  block[2 + paddingLength] = 0x00;
  block.set(message, 3 + paddingLength);

  const cipher = modPow(bytesToBigInt(block), PUBLIC_EXPONENT, BigInt("0x" + MODULUS_HEX));
  return Buffer.from(bigIntToBytes(cipher, KEY_BYTES)).toString("base64");
}

/**
 * Returns the value to send as SecurityCredential. Accepts either an already
 * encrypted credential (long Base64 string) or the operator's plain password,
 * which is encrypted here exactly as Safaricom's reference helper does:
 * the password is Base64 encoded first, then RSA encrypted.
 */
export function buildSecurityCredential(configured: string): string {
  const value = configured.trim();
  if (!value) throw new Error("mpesa_payout_not_configured");
  // Already-encrypted credentials are 344 Base64 characters for a 2048 bit key.
  if (value.length >= 300) return value;
  const passwordBase64 = Buffer.from(value, "utf8").toString("base64");
  return encryptPkcs1(new TextEncoder().encode(passwordBase64));
}
