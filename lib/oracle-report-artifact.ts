export async function verifyOracleArtifactBytes(
  bytes: Uint8Array,
  expectedSha256: unknown,
  expectedSizeBytes: number,
) {
  if (!Number.isSafeInteger(expectedSizeBytes) || expectedSizeBytes <= 0 || bytes.byteLength !== expectedSizeBytes) {
    return false;
  }
  if (typeof expectedSha256 !== "string" || !/^[0-9a-f]{64}$/i.test(expectedSha256)) {
    return false;
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const actualSha256 = Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
  return actualSha256 === expectedSha256.toLowerCase();
}
