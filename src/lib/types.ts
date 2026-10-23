/** All money values are stored as integer minor units (cents) to avoid float drift. */
export type Cents = number;

export type TxType = 'income' | 'expense';

export type AccountKind = 'bank' | 'cash' | 'card' | 'savings' | 'wallet' | 'other';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** Money already in the account before any tracked transactions. */
  openingBalance: Cents;
  color: string;
  note?: string;
  archived?: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: TxType;
  amount: Cents;
  category: string;
  note?: string;
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  /** Set on both legs of a transfer between accounts (expense in the source, income in the destination). */
  transferId?: string;
  /** Set when this transaction was recorded from a debt payment. */
  debtId?: string;
  /** Set when this transaction was recorded by marking a plan item done. */
  planId?: string;
  createdAt: string;
}

export interface PlanItem {
  id: string;
  label: string;
  amount: Cents;
  type: TxType;
  category: string;
  /** Marked once the planned spend/income has actually happened. */
  done: boolean;
  /** Transaction recorded in the plan's account when this item was marked done, if any. */
  transactionId?: string;
}

export interface Plan {
  id: string;
  name: string;
  startingAmount: Cents;
  /** Optional account the plan is funded from (used to prefill the starting amount). */
  accountId?: string;
  items: PlanItem[];
  note?: string;
  createdAt: string;
}

/**
 * - none: 0% interest.
 * - daily: interest accrues daily on the outstanding balance (rate ÷ 365 × days since the last payment)
 *   and is added at each payment — an amortizing loan, like a typical land or car loan.
 * - compound: like daily, but interest compounds at the chosen frequency.
 * - simple: flat interest on the amount financed for the whole term, added up front.
 */
export type InterestMethod = 'none' | 'daily' | 'compound' | 'simple';

export type Compounding = 'daily' | 'monthly' | 'annually';

export interface DebtPayment {
  id: string;
  date: string;
  amount: Cents;
  note?: string;
  /** Transaction recorded in an account for this payment, if any. */
  transactionId?: string;
  createdAt: string;
}

export interface Debt {
  id: string;
  name: string;
  lender?: string;
  /** Total amount borrowed / purchase price. */
  principal: Cents;
  downPayment: Cents;
  /** When the loan starts (and the down payment is made); interest accrues from here. */
  startDate: string;
  method: InterestMethod;
  /** Annual rate in percent, e.g. 3.5. */
  rate: number;
  compounding?: Compounding;
  /** Length of the loan in months (used by simple interest). */
  termMonths?: number;
  payments: DebtPayment[];
  note?: string;
  createdAt: string;
}

export type LockTimeout = 0 | 30 | 60 | 300;

export interface Settings {
  currency: string;
  lockTimeout: LockTimeout;
}

export interface AppData {
  version: 1;
  accounts: Account[];
  transactions: Transaction[];
  plans: Plan[];
  debts: Debt[];
  settings: Settings;
}
