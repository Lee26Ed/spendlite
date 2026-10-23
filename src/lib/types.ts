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
  settings: Settings;
}
