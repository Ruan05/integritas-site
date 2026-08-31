const SESSION_COOKIE = "integritas_crm_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(value: string): Promise<string> {
  const secret = process.env.CRM_SESSION_SECRET;
  if (!secret) throw new Error("CRM session secret is not configured");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  const password = process.env.CRM_PASSWORD;
  if (!password) return false;
  const [candidateHash, passwordHash] = await Promise.all([hmac(candidate), hmac(password)]);
  return safeEqual(candidateHash, passwordHash);
}

export async function createCrmSessionToken(): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${await hmac(payload)}`;
}

export async function isValidCrmSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiresAt, signature, extra] = token.split(".");
  if (!expiresAt || !signature || extra) return false;

  const expiry = Number(expiresAt);
  if (!Number.isInteger(expiry) || expiry <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, await hmac(expiresAt));
}

export const crmSessionCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_DURATION_SECONDS,
};
