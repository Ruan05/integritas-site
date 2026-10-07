export function reportNeedsHold(summary, markdown) {
  const text = `${summary}\n${markdown}`;
  return /terminal outcome\s*:\s*(?:incomplete|blocked)/i.test(text);
}
