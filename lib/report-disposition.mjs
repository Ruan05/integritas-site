export function reportNeedsHold(summary, markdown) {
  const text = `${summary}\n${markdown}`;
  return /terminal outcome\s*:\s*(?:incomplete|hold|blocked|direct verification required)/i.test(text)
    || /decision status\s*:\s*(?:incomplete|hold|blocked|direct verification required)/i.test(text)
    || /this is a draft work product/i.test(text);
}
