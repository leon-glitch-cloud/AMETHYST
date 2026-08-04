const COOKIE_NAME = "amethyst_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error("APP_SESSION_SECRET ist nicht gesetzt");
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(Math.floor(hex.length / 2)));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function createSessionCookieValue(): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const key = await getKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(expiresAt))
  );
  return `${expiresAt}.${toHex(signature)}`;
}

export async function isValidSessionCookie(
  value: string | undefined
): Promise<boolean> {
  if (!value) return false;
  const [expiresAtStr, signatureHex] = value.split(".");
  if (!expiresAtStr || !signatureHex) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const key = await getKey();
  return crypto.subtle.verify(
    "HMAC",
    key,
    fromHex(signatureHex),
    new TextEncoder().encode(expiresAtStr)
  );
}

export { COOKIE_NAME, SESSION_DURATION_MS };
