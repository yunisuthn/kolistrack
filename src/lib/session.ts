// Session signée par HMAC-SHA256 (Web Crypto) : utilisable dans proxy.ts
// comme dans les Server Actions. Format du jeton : "<expiration>.<signature>".

export const SESSION_COOKIE = "kolistrack_session";
export const SESSION_DURATION_S = 60 * 60 * 24 * 30; // 30 jours

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET manquant ou trop court (16 caractères minimum).");
  }
  return secret;
}

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`kolistrack:${payload}`));
  return toBase64Url(signature);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const expiration = Math.floor(Date.now() / 1000) + SESSION_DURATION_S;
  return `${expiration}.${await sign(String(expiration))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiration, signature] = token.split(".");
  if (!expiration || !signature || !/^\d+$/.test(expiration)) return false;
  if (Number(expiration) < Math.floor(Date.now() / 1000)) return false;
  try {
    return constantTimeEqual(signature, await sign(expiration));
  } catch {
    return false;
  }
}
