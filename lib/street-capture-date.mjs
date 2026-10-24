/** Provider dates may be epoch milliseconds or ISO strings; display a UTC date. */
export function streetCaptureDate(value) {
  if (value == null || value === '') return 'date unavailable';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) + ' UTC' : 'date unavailable';
}
