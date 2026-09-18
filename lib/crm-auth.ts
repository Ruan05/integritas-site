const SESSION_COOKIE = "integritas_crm_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const CRM_PASSWORD_SHA256 = "9d8ca7ea18e697e9110a4420107c2589c78bc731cf79ed9206ae900abe96487b";

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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  return safeEqual(await sha256Hex(candidate), CRM_PASSWORD_SHA256);
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
