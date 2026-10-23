import type { Cents } from './types';

export const CURRENCIES = ['BZD', 'USD'];
export const DEFAULT_CURRENCY = 'BZD';

/** Explicit symbols so Belize and US dollars are never confused (Intl often renders BZD as "BZD 1.00"). */
const SYMBOLS: Record<string, string> = { BZD: 'BZ$', USD: '$' };

const number = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(cents: Cents, currency: string, opts: { sign?: boolean } = {}) {
  const text = `${SYMBOLS[currency] ?? `${currency} `}${number.format(Math.abs(cents) / 100)}`;
  if (cents < 0) return `−${text}`;
  if (opts.sign && cents > 0) return `+${text}`;
  return text;
}

/** Parses user input like "1,234.5" into cents. Returns null when the input isn't a valid amount. */
export function parseMoney(input: string): Cents | null {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '-') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function centsToInput(cents: Cents) {
  return (cents / 100).toFixed(2);
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function today() {
  return toISODate(new Date());
}

export function formatDate(iso: string) {
  return fromISODate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDayHeader(iso: string) {
  const t = today();
  const y = toISODate(new Date(Date.now() - 86400000));
  if (iso === t) return 'Today';
  if (iso === y) return 'Yesterday';
  return fromISODate(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function formatMonth(key: string, style: 'short' | 'long' = 'short') {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: style, year: style === 'long' ? 'numeric' : '2-digit' });
}
