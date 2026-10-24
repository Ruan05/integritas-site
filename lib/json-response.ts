/** Object envelope shared by the existing authenticated JSON APIs. */
export async function readJsonObject(response: Pick<Response,"json">): Promise<Record<string, any>> {
  const value: unknown = await response.json().catch(() => ({}));
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}
