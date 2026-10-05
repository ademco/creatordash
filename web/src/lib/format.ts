// Number and date formatting. Dates arrive as YYYY-MM-DD strings, which mean a
// calendar day, so they are formatted in UTC: formatting them in local time
// can shift them a day for anyone west of London.

const whole = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** 12345 -> "12,345" */
export function formatNumber(value: number): string {
  return whole.format(value);
}

/** 1204 -> "+1,204", -15 -> "−15" (a real minus sign), 0 -> "0" */
export function formatSigned(value: number): string {
  if (value > 0) return `+${whole.format(value)}`;
  if (value < 0) return `−${whole.format(Math.abs(value))}`;
  return '0';
}

/** 12345 -> "12.3K"; with signed, positive values get a "+" */
export function formatCompact(value: number, signed = false): string {
  const text = compact.format(Math.abs(value));
  if (value < 0) return `−${text}`;
  return signed && value > 0 ? `+${text}` : text;
}

/** 0.3849 -> "38%" */
export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** 4.123 -> "4.1×" */
export function formatMultiple(multiple: number): string {
  return `${multiple.toFixed(1)}×`;
}

function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

/** "2026-09-30" -> "Sep 30" */
export function formatShortDate(isoDate: string): string {
  return shortDate.format(toDate(isoDate));
}

/** "2026-09-30" -> "Sep 30, 2026" */
export function formatLongDate(isoDate: string): string {
  return longDate.format(toDate(isoDate));
}
