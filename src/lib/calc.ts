import { monthKey, toISODate } from './format';
import type { Account, Cents, Plan, Transaction, TxType } from './types';

export interface Totals {
  income: Cents;
  expense: Cents;
  net: Cents;
}

export function totalsOf(txs: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

export interface AccountSummary extends Totals {
  account: Account;
  /** Opening balance + income − expense. */
  balance: Cents;
  count: number;
}

export function summarizeAccount(account: Account, txs: Transaction[]): AccountSummary {
  const own = txs.filter((t) => t.accountId === account.id);
  const totals = totalsOf(own);
  return { ...totals, account, balance: account.openingBalance + totals.net, count: own.length };
}

export interface Overall extends Totals {
  opening: Cents;
  balance: Cents;
}

/** Moving money between your own accounts isn't income or spending. */
export const isTransfer = (t: Transaction) => !!t.transferId;
export const withoutTransfers = (txs: Transaction[]) => txs.filter((t) => !t.transferId);

export function overallSummary(accounts: Account[], txs: Transaction[]): Overall {
  const ids = new Set(accounts.map((a) => a.id));
  const own = txs.filter((t) => ids.has(t.accountId));
  // Balance counts every leg (a transfer to an archived account does leave these accounts);
  // money in / spent leave transfers out.
  const totals = totalsOf(withoutTransfers(own));
  const opening = accounts.reduce((s, a) => s + a.openingBalance, 0);
  return { ...totals, opening, balance: opening + totalsOf(own).net };
}

export interface CategoryTotal {
  category: string;
  total: Cents;
  count: number;
}

export function categoryBreakdown(txs: Transaction[], type: TxType): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const t of txs) {
    if (t.type !== type || isTransfer(t)) continue;
    const key = t.category || 'Uncategorized';
    const entry = map.get(key) ?? { category: key, total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export interface MonthPoint {
  key: string;
  income: Cents;
  expense: Cents;
}

/** Income and expense totals for the last `months` calendar months, oldest first. */
export function monthlySeries(txs: Transaction[], months = 6): MonthPoint[] {
  const now = new Date();
  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({ key: monthKey(toISODate(d)), income: 0, expense: 0 });
  }
  const byKey = new Map(points.map((p) => [p.key, p]));
  for (const t of txs) {
    const p = byKey.get(monthKey(t.date));
    if (!p || isTransfer(t)) continue;
    if (t.type === 'income') p.income += t.amount;
    else p.expense += t.amount;
  }
  return points;
}

export interface PlanSummary {
  plannedIncome: Cents;
  plannedExpense: Cents;
  /** What is left if everything in the plan happens. */
  projectedLeft: Cents;
  doneIncome: Cents;
  doneExpense: Cents;
  /** What is left given only the items marked done. */
  currentLeft: Cents;
  /** Planned expenses not yet marked done. */
  pendingExpense: Cents;
}

export function summarizePlan(plan: Plan): PlanSummary {
  let plannedIncome = 0;
  let plannedExpense = 0;
  let doneIncome = 0;
  let doneExpense = 0;
  for (const item of plan.items) {
    if (item.type === 'income') {
      plannedIncome += item.amount;
      if (item.done) doneIncome += item.amount;
    } else {
      plannedExpense += item.amount;
      if (item.done) doneExpense += item.amount;
    }
  }
  return {
    plannedIncome,
    plannedExpense,
    projectedLeft: plan.startingAmount + plannedIncome - plannedExpense,
    doneIncome,
    doneExpense,
    currentLeft: plan.startingAmount + doneIncome - doneExpense,
    pendingExpense: plannedExpense - doneExpense,
  };
}
