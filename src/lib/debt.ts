import { today } from './format';
import type { Cents, Compounding, Debt, DebtPayment, InterestMethod } from './types';

// Loan math works in unrounded cents so long schedules match a spreadsheet exactly;
// round only when displaying.

export const INTEREST_METHODS: { key: InterestMethod; label: string; description: string }[] = [
  {
    key: 'daily',
    label: 'Amortized (daily)',
    description: 'Interest is charged on what you still owe, for the days since your last payment: balance × rate ÷ 365 × days.',
  },
  {
    key: 'compound',
    label: 'Compound',
    description: 'Like amortized, but interest compounds daily, monthly or yearly on what you still owe.',
  },
  {
    key: 'simple',
    label: 'Simple (flat)',
    description: 'One fixed interest charge on the amount financed for the whole term, added up front.',
  },
  { key: 'none', label: 'No interest', description: 'You only pay back what you borrowed.' },
];

export const COMPOUNDING: { key: Compounding; label: string; perYear: number }[] = [
  { key: 'daily', label: 'Daily', perYear: 365 },
  { key: 'monthly', label: 'Monthly', perYear: 12 },
  { key: 'annually', label: 'Yearly', perYear: 1 },
];

export function interestLabel(debt: Pick<Debt, 'method' | 'rate'>) {
  if (debt.method === 'none' || debt.rate <= 0) return 'No interest';
  return `${debt.rate}% · ${INTEREST_METHODS.find((m) => m.key === debt.method)?.label ?? ''}`;
}

/** Whole days from `from` to `to` (ISO dates), ignoring time zones and DST. */
export function daysBetween(from: string, to: string) {
  const utc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

type InterestTerms = Pick<Debt, 'method' | 'rate' | 'compounding'>;

/** Interest that accrues on `balance` over `days` days. */
export function periodInterest(debt: InterestTerms, balance: number, days: number) {
  if (balance <= 0 || days <= 0 || debt.rate <= 0) return 0;
  const r = debt.rate / 100;
  if (debt.method === 'daily') return ((balance * r) / 365) * days;
  if (debt.method === 'compound') {
    const n = COMPOUNDING.find((c) => c.key === (debt.compounding ?? 'monthly'))?.perYear ?? 12;
    return balance * ((1 + r / n) ** ((n * days) / 365) - 1);
  }
  return 0;
}

export function upfrontInterest(debt: Pick<Debt, 'method' | 'rate' | 'termMonths' | 'principal' | 'downPayment'>) {
  if (debt.method !== 'simple' || debt.rate <= 0) return 0;
  const financed = Math.max(0, debt.principal - debt.downPayment);
  return financed * (debt.rate / 100) * ((debt.termMonths ?? 12) / 12);
}

export interface ScheduleRow {
  /** 0 is the down payment (when there is one); payments count up from 1 after it. */
  number: number;
  kind: 'down' | 'payment';
  payment?: DebtPayment;
  date: string;
  /** Days since the previous row. */
  days: number;
  interest: number;
  amount: Cents;
  /** Balance after this row. */
  balance: number;
}

export interface DebtSummary {
  rows: ScheduleRow[];
  /** Principal minus down payment. */
  financed: Cents;
  upfrontInterest: number;
  /** Total interest charged so far (including any up-front interest). */
  interestCharged: number;
  /** Down payment plus all payments. */
  totalPaid: Cents;
  /** Balance as of the last payment. */
  balance: number;
  /** Interest accrued from the last payment until `asOf`. */
  accrued: number;
  /** What it would take to clear the loan on `asOf`. */
  payoff: number;
  paidOff: boolean;
  /** 0–1: share of the amount owed that has been cleared. */
  progress: number;
  lastDate: string;
}

export function sortPayments(payments: DebtPayment[]) {
  return [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export function summarizeDebt(debt: Debt, asOf = today()): DebtSummary {
  const financed = Math.max(0, debt.principal - debt.downPayment);
  const upfront = upfrontInterest(debt);
  const rows: ScheduleRow[] = [];
  let balance = financed + upfront;
  let prev = debt.startDate;
  let interestCharged = upfront;

  if (debt.downPayment > 0) {
    rows.push({ number: 0, kind: 'down', date: debt.startDate, days: 0, interest: 0, amount: debt.downPayment, balance });
  }

  sortPayments(debt.payments).forEach((p, i) => {
    const days = Math.max(0, daysBetween(prev, p.date));
    const interest = periodInterest(debt, balance, days);
    balance = balance + interest - p.amount;
    interestCharged += interest;
    rows.push({ number: i + 1, kind: 'payment', payment: p, date: p.date, days, interest, amount: p.amount, balance });
    if (p.date > prev) prev = p.date;
  });

  const accrued = periodInterest(debt, balance, Math.max(0, daysBetween(prev, asOf)));
  const totalOwed = financed + interestCharged;
  const paidOff = balance < 0.5;
  return {
    rows,
    financed,
    upfrontInterest: upfront,
    interestCharged,
    totalPaid: debt.downPayment + debt.payments.reduce((s, p) => s + p.amount, 0),
    balance,
    accrued,
    payoff: Math.max(0, balance + accrued),
    paidOff,
    progress: paidOff ? 1 : totalOwed > 0 ? Math.max(0, Math.min(1, 1 - balance / totalOwed)) : 0,
    lastDate: prev,
  };
}

/** Interest and balance a new payment would produce, for previewing it before saving. */
export function previewPayment(debt: Debt, amount: Cents, date: string, excludeId?: string) {
  const others = debt.payments.filter((p) => p.id !== excludeId && p.date <= date);
  const before = summarizeDebt({ ...debt, payments: others }, date);
  const days = Math.max(0, daysBetween(before.lastDate, date));
  const interest = periodInterest(debt, before.balance, days);
  return { days, interest, balance: before.balance + interest - amount };
}

export interface PayoffEstimate {
  payments: number;
  date: string;
  amount: Cents;
  everyDays: number;
}

/**
 * Projects when the loan is cleared if payments continue like the recent ones
 * (same amount, same average spacing). Null when that would never pay it off.
 */
export function estimatePayoff(debt: Debt, summary: DebtSummary): PayoffEstimate | null {
  if (summary.paidOff) return null;
  const recent = sortPayments(debt.payments).slice(-4);
  if (!recent.length) return null;
  const amount = recent[recent.length - 1].amount;
  const gaps = recent.slice(1).map((p, i) => daysBetween(recent[i].date, p.date)).filter((g) => g > 0);
  const everyDays = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : 30;

  let balance = summary.balance;
  let date = new Date(`${summary.lastDate}T00:00:00Z`);
  for (let n = 1; n <= 1200; n++) {
    const interest = periodInterest(debt, balance, everyDays);
    if (interest >= amount) return null;
    balance = balance + interest - amount;
    date = new Date(date.getTime() + everyDays * 86_400_000);
    if (balance < 0.5) return { payments: n, date: date.toISOString().slice(0, 10), amount, everyDays };
  }
  return null;
}
