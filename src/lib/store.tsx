import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CURRENCIES, DEFAULT_CURRENCY } from './format';
import type { Account, AppData, Plan, Settings, Transaction } from './types';

const STORAGE_KEY = 'spendlite:data:v1';

export const emptyData: AppData = {
  version: 1,
  accounts: [],
  transactions: [],
  plans: [],
  settings: { currency: DEFAULT_CURRENCY, lockTimeout: 0 },
};

export const newId = () => randomUUID();
const now = () => new Date().toISOString();

type New<T> = Omit<T, 'id' | 'createdAt'>;

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
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (next: AppData) => void;
  mergeIn: (incoming: AppData) => { accounts: number; transactions: number; plans: number };
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
    setData((d) => ({
      ...d,
      accounts: d.accounts.filter((a) => a.id !== id),
      transactions: d.transactions.filter((t) => t.accountId !== id),
      plans: d.plans.map((p) => (p.accountId === id ? { ...p, accountId: undefined } : p)),
    }));
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
    setData((d) => ({ ...d, plans: d.plans.filter((p) => p.id !== id) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const replaceAll = useCallback((next: AppData) => setData(next), []);

  const mergeIn = useCallback(
    (incoming: AppData) => {
      // Records are matched by id: existing ones are kept, unknown ones are added.
      const counts = { accounts: 0, transactions: 0, plans: 0 };
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
      updateSettings,
      replaceAll,
      mergeIn,
      wipe,
    }),
    [data, ready, addAccount, updateAccount, deleteAccount, addTransaction, updateTransaction, deleteTransaction, addPlan, updatePlan, deletePlan, updateSettings, replaceAll, mergeIn, wipe],
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
