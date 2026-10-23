import { toISODate } from './format';
import type { Account, Transaction, TxType } from './types';

export type PeriodKey = 'all' | 'this-month' | 'last-month' | 'last-30' | 'last-90' | 'this-year' | 'custom';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'last-30', label: 'Last 30 days' },
  { key: 'last-90', label: 'Last 90 days' },
  { key: 'this-year', label: 'This year' },
  { key: 'custom', label: 'Custom' },
];

export type TxSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'category';

export const TX_SORTS: { key: TxSort; label: string }[] = [
  { key: 'date-desc', label: 'Newest first' },
  { key: 'date-asc', label: 'Oldest first' },
  { key: 'amount-desc', label: 'Amount: high to low' },
  { key: 'amount-asc', label: 'Amount: low to high' },
  { key: 'category', label: 'Category (A–Z)' },
];

export interface TxFilter {
  search: string;
  type: 'all' | TxType;
  accountIds: string[];
  categories: string[];
  period: PeriodKey;
  from?: string;
  to?: string;
  sort: TxSort;
}

export const defaultTxFilter: TxFilter = {
  search: '',
  type: 'all',
  accountIds: [],
  categories: [],
  period: 'all',
  sort: 'date-desc',
};

/** Inclusive [from, to] ISO date bounds for a period, or undefined bounds for "all". */
export function periodRange(period: PeriodKey, from?: string, to?: string): { from?: string; to?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'this-month':
      return { from: toISODate(new Date(y, m, 1)), to: toISODate(new Date(y, m + 1, 0)) };
    case 'last-month':
      return { from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) };
    case 'last-30':
      return { from: toISODate(new Date(y, m, now.getDate() - 29)), to: toISODate(now) };
    case 'last-90':
      return { from: toISODate(new Date(y, m, now.getDate() - 89)), to: toISODate(now) };
    case 'this-year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'custom':
      return { from, to };
    default:
      return {};
  }
}

export function inPeriod(txs: Transaction[], period: PeriodKey, from?: string, to?: string) {
  const r = periodRange(period, from, to);
  return txs.filter((t) => (!r.from || t.date >= r.from) && (!r.to || t.date <= r.to));
}

export function countActiveFilters(f: TxFilter, lockedAccount = false) {
  let n = 0;
  if (f.type !== 'all') n++;
  if (!lockedAccount && f.accountIds.length) n++;
  if (f.categories.length) n++;
  if (f.period !== 'all') n++;
  return n;
}

export function applyTxFilter(txs: Transaction[], f: TxFilter, accounts: Account[]): Transaction[] {
  const accountNames = new Map(accounts.map((a) => [a.id, a.name.toLowerCase()]));
  const q = f.search.trim().toLowerCase();
  const accountSet = new Set(f.accountIds);
  const catSet = new Set(f.categories);

  const result = inPeriod(txs, f.period, f.from, f.to).filter((t) => {
    if (f.type !== 'all' && t.type !== f.type) return false;
    if (accountSet.size && !accountSet.has(t.accountId)) return false;
    if (catSet.size && !catSet.has(t.category)) return false;
    if (q) {
      const haystack = [t.category, t.note ?? '', accountNames.get(t.accountId) ?? '', (t.amount / 100).toFixed(2), t.date]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return sortTransactions(result, f.sort);
}

export function sortTransactions(txs: Transaction[], sort: TxSort) {
  const out = [...txs];
  const byDateDesc = (a: Transaction, b: Transaction) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case 'date-asc':
      return out.sort((a, b) => -byDateDesc(a, b));
    case 'amount-desc':
      return out.sort((a, b) => b.amount - a.amount || byDateDesc(a, b));
    case 'amount-asc':
      return out.sort((a, b) => a.amount - b.amount || byDateDesc(a, b));
    case 'category':
      return out.sort((a, b) => a.category.localeCompare(b.category) || byDateDesc(a, b));
    default:
      return out.sort(byDateDesc);
  }
}
