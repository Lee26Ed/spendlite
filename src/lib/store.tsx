import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CURRENCIES, DEFAULT_CURRENCY } from './format';
import { reconcilePlanItem, removePlanItem, syncItemFromPayment, untickForDeletedPayment } from './planLinks';
import type { Account, AppData, Debt, DebtPayment, Plan, PlanItem, Settings, Transaction } from './types';

const STORAGE_KEY = 'spendlite:data:v1';

export const emptyData: AppData = {
  version: 1,
  accounts: [],
  transactions: [],
  plans: [],
  debts: [],
  settings: { currency: DEFAULT_CURRENCY, lockTimeout: 0 },
};

export const newId = () => randomUUID();
const now = () => new Date().toISOString();
const ids = { newId, now };

type New<T> = Omit<T, 'id' | 'createdAt'>;

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}

export { findPlanItemPayment, findPlanItemTransaction, planItemNote } from './planLinks';

export interface PaymentInput {
  date: string;
  amount: number;
  note?: string;
}

interface DataContextValue {
  data: AppData;
  ready: boolean;
  addAccount: (a: New<Account>) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (t: New<Transaction>) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addPlan: (p: New<Plan>) => Plan;
  updatePlan: (id: string, patch: Partial<Plan>) => void;
  deletePlan: (id: string) => void;
  /**
   * Marks a plan item done or not done. Marking done with `recordIn` also records it in that account,
   * and a planned debt payment adds a payment to its debt; marking not done removes both.
   */
  setPlanItemDone: (planId: string, itemId: string, done: boolean, recordIn?: string) => void;
  /** Adds or replaces a plan item, keeping its recorded transaction and debt payment in step (removed if no longer done). */
  savePlanItem: (planId: string, item: PlanItem) => void;
  deletePlanItem: (planId: string, itemId: string, opts: { removeRecorded: boolean }) => void;
  /** Creates (or, with `transferId`, replaces) both legs of a transfer. Returns the transfer id. */
  saveTransfer: (input: TransferInput, transferId?: string) => string;
  deleteTransfer: (transferId: string) => void;
  addDebt: (d: New<Debt>) => Debt;
  updateDebt: (id: string, patch: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  /**
   * Adds or updates a debt payment. With `accountId` the payment is also recorded as an expense in that
   * account (and kept in sync); `accountId: null` removes any recorded expense.
   */
  saveDebtPayment: (debtId: string, input: PaymentInput, opts: { paymentId?: string; accountId: string | null }) => void;
  deleteDebtPayment: (debtId: string, paymentId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (next: AppData) => void;
  mergeIn: (incoming: AppData) => { accounts: number; transactions: number; plans: number; debts: number };
  wipe: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as AppData;
          const settings = { ...emptyData.settings, ...parsed.settings };
          // Only BZD and USD are offered; anything else saved by an older version falls back to the default.
          if (!CURRENCIES.includes(settings.currency)) settings.currency = DEFAULT_CURRENCY;
          setData({ ...emptyData, ...parsed, settings });
        }
      })
      .catch((e) => console.warn('Failed to load data', e))
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((e) => console.warn('Failed to save data', e));
  }, [data]);

  const addAccount = useCallback((a: New<Account>) => {
    const account: Account = { ...a, id: newId(), createdAt: now() };
    setData((d) => ({ ...d, accounts: [...d.accounts, account] }));
    return account;
  }, []);

  const updateAccount = useCallback((id: string, patch: Partial<Account>) => {
    setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch, id } : a)) }));
  }, []);

  const deleteAccount = useCallback((id: string) => {
    setData((d) => {
      const removed = d.transactions.filter((t) => t.accountId === id);
      // Transfers lose both legs; debt payments keep counting but forget the deleted expense.
      const transferIds = new Set(removed.map((t) => t.transferId).filter(Boolean));
      const removedIds = new Set(removed.map((t) => t.id));
      return {
        ...d,
        accounts: d.accounts.filter((a) => a.id !== id),
        transactions: d.transactions.filter((t) => t.accountId !== id && !(t.transferId && transferIds.has(t.transferId))),
        plans: d.plans.map((p) => (p.accountId === id ? { ...p, accountId: undefined } : p)),
        debts: d.debts.map((debt) => ({
          ...debt,
          payments: debt.payments.map((p) => (p.transactionId && removedIds.has(p.transactionId) ? { ...p, transactionId: undefined } : p)),
        })),
      };
    });
  }, []);

  const addTransaction = useCallback((t: New<Transaction>) => {
    const tx: Transaction = { ...t, id: newId(), createdAt: now() };
    setData((d) => ({ ...d, transactions: [...d.transactions, tx] }));
    return tx;
  }, []);

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setData((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch, id } : t)) }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
  }, []);

  const addPlan = useCallback((p: New<Plan>) => {
    const plan: Plan = { ...p, id: newId(), createdAt: now() };
    setData((d) => ({ ...d, plans: [...d.plans, plan] }));
    return plan;
  }, []);

  const updatePlan = useCallback((id: string, patch: Partial<Plan>) => {
    setData((d) => ({ ...d, plans: d.plans.map((p) => (p.id === id ? { ...p, ...patch, id } : p)) }));
  }, []);

  const deletePlan = useCallback((id: string) => {
    // Recorded expenses and debt payments stay: that money really moved.
    setData((d) => ({
      ...d,
      plans: d.plans.filter((p) => p.id !== id),
      transactions: d.transactions.map((t) => (t.planId === id ? { ...t, planId: undefined } : t)),
      debts: d.debts.map((x) => ({
        ...x,
        payments: x.payments.map((p) => (p.planId === id ? { ...p, planId: undefined, planItemId: undefined } : p)),
      })),
    }));
  }, []);

  const setPlanItemDone = useCallback((planId: string, itemId: string, done: boolean, recordIn?: string) => {
    setData((d) => {
      const item = d.plans.find((p) => p.id === planId)?.items.find((i) => i.id === itemId);
      return item ? reconcilePlanItem(d, planId, item, { ...item, done }, ids, { recordIn: done ? recordIn : undefined }) : d;
    });
  }, []);

  const savePlanItem = useCallback((planId: string, item: PlanItem) => {
    setData((d) => {
      const previous = d.plans.find((p) => p.id === planId)?.items.find((i) => i.id === item.id);
      return reconcilePlanItem(d, planId, previous, item, ids);
    });
  }, []);

  const deletePlanItem = useCallback((planId: string, itemId: string, opts: { removeRecorded: boolean }) => {
    setData((d) => removePlanItem(d, planId, itemId, ids, opts.removeRecorded));
  }, []);

  const saveTransfer = useCallback((input: TransferInput, transferId?: string) => {
    const id = transferId ?? newId();
    setData((d) => {
      const createdAt = d.transactions.find((t) => t.transferId === id)?.createdAt ?? now();
      const leg = (accountId: string, type: Transaction['type']): Transaction => ({
        id: newId(),
        accountId,
        type,
        amount: input.amount,
        category: 'Transfer',
        note: input.note,
        date: input.date,
        transferId: id,
        createdAt,
      });
      return {
        ...d,
        transactions: [
          ...d.transactions.filter((t) => t.transferId !== id),
          leg(input.fromAccountId, 'expense'),
          leg(input.toAccountId, 'income'),
        ],
      };
    });
    return id;
  }, []);

  const deleteTransfer = useCallback((transferId: string) => {
    setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.transferId !== transferId) }));
  }, []);

  const addDebt = useCallback((input: New<Debt>) => {
    const debt: Debt = { ...input, id: newId(), createdAt: now() };
    setData((d) => ({ ...d, debts: [...d.debts, debt] }));
    return debt;
  }, []);

  const updateDebt = useCallback((id: string, patch: Partial<Debt>) => {
    setData((d) => ({ ...d, debts: d.debts.map((x) => (x.id === id ? { ...x, ...patch, id } : x)) }));
  }, []);

  const deleteDebt = useCallback((id: string) => {
    // Expenses already recorded in accounts stay: that money really left the account.
    // Plan items that paid toward it keep their done state but no longer point at it.
    setData((d) => ({
      ...d,
      debts: d.debts.filter((x) => x.id !== id),
      transactions: d.transactions.map((t) => (t.debtId === id ? { ...t, debtId: undefined } : t)),
      plans: d.plans.map((p) => ({
        ...p,
        items: p.items.map((i) => (i.debtId === id ? { ...i, debtId: undefined, debtPaymentId: undefined } : i)),
      })),
    }));
  }, []);

  const saveDebtPayment = useCallback(
    (debtId: string, input: PaymentInput, opts: { paymentId?: string; accountId: string | null }) => {
      setData((d) => {
        const debt = d.debts.find((x) => x.id === debtId);
        if (!debt) return d;
        const existing = debt.payments.find((p) => p.id === opts.paymentId);
        let transactions = d.transactions;
        let transactionId = existing?.transactionId;
        const linked = transactionId ? transactions.find((t) => t.id === transactionId) : undefined;

        if (opts.accountId) {
          const fields = {
            accountId: opts.accountId,
            type: 'expense' as const,
            amount: input.amount,
            category: 'Debt payment',
            note: input.note ? `${debt.name} · ${input.note}` : debt.name,
            date: input.date,
            debtId,
          };
          if (linked) {
            transactions = transactions.map((t) => (t.id === linked.id ? { ...t, ...fields } : t));
          } else {
            const tx: Transaction = { ...fields, id: newId(), createdAt: now() };
            transactionId = tx.id;
            transactions = [...transactions, tx];
          }
        } else {
          if (linked) transactions = transactions.filter((t) => t.id !== linked.id);
          transactionId = undefined;
        }

        const payment: DebtPayment = {
          ...existing,
          id: existing?.id ?? newId(),
          createdAt: existing?.createdAt ?? now(),
          ...input,
          transactionId,
        };
        const payments = existing ? debt.payments.map((p) => (p.id === existing.id ? payment : p)) : [...debt.payments, payment];
        // A payment planned in a plan keeps that plan item's amount and date in step.
        return syncItemFromPayment({ ...d, transactions, debts: d.debts.map((x) => (x.id === debtId ? { ...x, payments } : x)) }, payment);
      });
    },
    [],
  );

  const deleteDebtPayment = useCallback((debtId: string, paymentId: string) => {
    setData((d) => {
      const payment = d.debts.find((x) => x.id === debtId)?.payments.find((p) => p.id === paymentId);
      if (!payment) return d;
      const next = {
        ...d,
        transactions: payment.transactionId ? d.transactions.filter((t) => t.id !== payment.transactionId) : d.transactions,
        debts: d.debts.map((x) => (x.id === debtId ? { ...x, payments: x.payments.filter((p) => p.id !== paymentId) } : x)),
      };
      // A payment that came from a plan un-ticks its plan item.
      return untickForDeletedPayment(next, payment);
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const replaceAll = useCallback((next: AppData) => setData(next), []);

  const mergeIn = useCallback(
    (incoming: AppData) => {
      // Records are matched by id: existing ones are kept, unknown ones are added.
      const counts = { accounts: 0, transactions: 0, plans: 0, debts: 0 };
      const merge = <T extends { id: string }>(current: T[], extra: T[], key: keyof typeof counts) => {
        const ids = new Set(current.map((x) => x.id));
        const added = extra.filter((x) => !ids.has(x.id));
        counts[key] = added.length;
        return [...current, ...added];
      };
      const next: AppData = {
        ...data,
        accounts: merge(data.accounts, incoming.accounts, 'accounts'),
        transactions: merge(data.transactions, incoming.transactions, 'transactions'),
        plans: merge(data.plans, incoming.plans, 'plans'),
        debts: merge(data.debts, incoming.debts ?? [], 'debts'),
      };
      setData(next);
      return counts;
    },
    [data],
  );

  const wipe = useCallback(() => setData((d) => ({ ...emptyData, settings: d.settings })), []);

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      ready,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addPlan,
      updatePlan,
      deletePlan,
      setPlanItemDone,
      savePlanItem,
      deletePlanItem,
      saveTransfer,
      deleteTransfer,
      addDebt,
      updateDebt,
      deleteDebt,
      saveDebtPayment,
      deleteDebtPayment,
      updateSettings,
      replaceAll,
      mergeIn,
      wipe,
    }),
    [data, ready, addAccount, updateAccount, deleteAccount, addTransaction, updateTransaction, deleteTransaction, addPlan, updatePlan, deletePlan, setPlanItemDone, savePlanItem, deletePlanItem, saveTransfer, deleteTransfer, addDebt, updateDebt, deleteDebt, saveDebtPayment, deleteDebtPayment, updateSettings, replaceAll, mergeIn, wipe],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

export function useCurrency() {
  return useData().data.settings.currency;
}
