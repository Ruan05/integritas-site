/** Display repair for historical replies; original stored text stays available. */
export function storedAssistantReply(content) {
  const unchanged = {text: content, original: null};
  const marker = /\n[ \t]*\{"reply"\s*:\s*"(?:\\.|[^"\\])*"\s*,\s*"memory"\s*:\s*$/.exec(content);
  if (!marker) return unchanged;
  const prefix = content.slice(0, marker.index).trim();
  // Keep quoted examples and ordinary structured evidence as authored.
  if (!prefix || /[:：]$/.test(prefix) || prefix.includes('```') || prefix.includes('~~~')) return unchanged;
  return {text: prefix, original: content};
}
