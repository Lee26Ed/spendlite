import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { CURRENCIES } from './format';
import { accountColors } from './theme';
import { newId } from './store';
import type { Account, AppData, Debt, DebtPayment, Plan, Transaction, TxType } from './types';

const CSV_HEADER = ['date', 'account', 'type', 'category', 'amount', 'note'];

interface BackupFile {
  app: 'spendlite';
  version: 1;
  exportedAt: string;
  data: AppData;
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

async function shareText(name: string, contents: string, mimeType: string, UTI: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, UTI, dialogTitle: 'Export SpendLite data' });
}

export async function exportJson(data: AppData) {
  const payload: BackupFile = { app: 'spendlite', version: 1, exportedAt: new Date().toISOString(), data };
  await shareText(`spendlite-backup-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json', 'public.json');
}

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(data: AppData) {
  const names = new Map(data.accounts.map((a) => [a.id, a.name]));
  const rows = [...data.transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) =>
      [t.date, names.get(t.accountId) ?? '', t.type, t.category, (t.amount / 100).toFixed(2), t.note ?? '']
        .map(csvCell)
        .join(','),
    );
  return [CSV_HEADER.join(','), ...rows].join('\n');
}

export async function exportCsv(data: AppData) {
  await shareText(`spendlite-transactions-${stamp()}.csv`, toCsv(data), 'text/csv', 'public.comma-separated-values-text');
}

/** Minimal RFC 4180 parser: handles quoted cells, escaped quotes and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validateBackup(raw: unknown): AppData {
  const obj = raw as Partial<BackupFile> & Partial<AppData>;
  const data = (obj && obj.app === 'spendlite' ? obj.data : obj) as Partial<AppData> | undefined;
  if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
    throw new Error('This file is not a SpendLite backup.');
  }
  const accounts = data.accounts.filter((a: Account) => isStr(a?.id) && isStr(a?.name) && isNum(a?.openingBalance));
  const ids = new Set(accounts.map((a) => a.id));
  const transactions = data.transactions.filter(
    (t: Transaction) =>
      isStr(t?.id) && ids.has(t.accountId) && (t.type === 'income' || t.type === 'expense') && isNum(t.amount) && isStr(t.date),
  );
  const plans = (Array.isArray(data.plans) ? data.plans : []).filter(
    (p: Plan) => isStr(p?.id) && isStr(p?.name) && isNum(p?.startingAmount) && Array.isArray(p?.items),
  );
  const methods = ['none', 'daily', 'compound', 'simple'];
  const debts = (Array.isArray(data.debts) ? data.debts : [])
    .filter(
      (d: Debt) =>
        isStr(d?.id) && isStr(d?.name) && isNum(d?.principal) && isStr(d?.startDate) && methods.includes(d?.method) && Array.isArray(d?.payments),
    )
    .map((d) => ({
      ...d,
      downPayment: isNum(d.downPayment) ? d.downPayment : 0,
      rate: isNum(d.rate) ? d.rate : 0,
      payments: d.payments
        .filter((p: DebtPayment) => isStr(p?.id) && isStr(p?.date) && isNum(p?.amount))
        .map((p) => ({ ...p, createdAt: p.createdAt ?? p.date })),
      createdAt: d.createdAt ?? new Date().toISOString(),
    }));
  return {
    version: 1,
    accounts: accounts.map((a, i) => ({ ...a, kind: a.kind ?? 'other', color: a.color ?? accountColors[i % accountColors.length] })),
    transactions: transactions.map((t) => ({ ...t, category: t.category ?? 'Other', createdAt: t.createdAt ?? new Date().toISOString() })),
    plans,
    debts,
    settings: {
      currency: isStr(data.settings?.currency) && CURRENCIES.includes(data.settings.currency) ? data.settings.currency : 'BZD',
      lockTimeout: data.settings?.lockTimeout ?? 0,
    },
  };
}

function csvToData(text: string, existing: AppData): { data: AppData; skipped: number } {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('The CSV file is empty.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = { date: col('date'), account: col('account'), type: col('type'), category: col('category'), amount: col('amount'), note: col('note') };
  if (idx.date < 0 || idx.amount < 0) throw new Error('CSV needs at least "date" and "amount" columns.');

  const accountsByName = new Map(existing.accounts.map((a) => [a.name.trim().toLowerCase(), a]));
  const newAccounts: Account[] = [];
  const signatures = new Set(
    existing.transactions.map((t) => [t.accountId, t.date, t.type, t.amount, t.category, t.note ?? ''].join('|')),
  );
  const transactions: Transaction[] = [];
  let skipped = 0;

  const accountFor = (rawName: string) => {
    const name = rawName.trim() || 'Imported';
    const key = name.toLowerCase();
    let account = accountsByName.get(key);
    if (!account) {
      account = {
        id: newId(),
        name,
        kind: 'other',
        openingBalance: 0,
        color: accountColors[(existing.accounts.length + newAccounts.length) % accountColors.length],
        createdAt: new Date().toISOString(),
      };
      accountsByName.set(key, account);
      newAccounts.push(account);
    }
    return account;
  };

  for (const r of rows.slice(1)) {
    const date = r[idx.date]?.trim() ?? '';
    const rawAmount = Number((r[idx.amount] ?? '').replace(/[^0-9.\-]/g, ''));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(rawAmount) || rawAmount === 0) {
      skipped++;
      continue;
    }
    const typeCell = idx.type >= 0 ? r[idx.type]?.trim().toLowerCase() : '';
    // Without an explicit type, negative amounts are expenses.
    const type: TxType = typeCell === 'income' || typeCell === 'expense' ? typeCell : rawAmount < 0 ? 'expense' : 'income';
    const account = accountFor(idx.account >= 0 ? r[idx.account] ?? '' : '');
    const tx: Transaction = {
      id: newId(),
      accountId: account.id,
      type,
      amount: Math.round(Math.abs(rawAmount) * 100),
      category: (idx.category >= 0 ? r[idx.category]?.trim() : '') || 'Other',
      note: (idx.note >= 0 ? r[idx.note]?.trim() : '') || undefined,
      date,
      createdAt: new Date().toISOString(),
    };
    const sig = [tx.accountId, tx.date, tx.type, tx.amount, tx.category, tx.note ?? ''].join('|');
    if (signatures.has(sig)) {
      skipped++;
      continue;
    }
    signatures.add(sig);
    transactions.push(tx);
  }

  return { data: { ...existing, accounts: newAccounts, transactions, plans: [], debts: [] }, skipped };
}

export type ImportResult =
  | { kind: 'json'; data: AppData; fileName: string }
  | { kind: 'csv'; data: AppData; skipped: number; fileName: string };

export async function pickImportFile(existing: AppData): Promise<ImportResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/csv', 'text/comma-separated-values', 'text/plain', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const text = await new File(asset.uri).text();
  const name = asset.name ?? 'file';
  const looksJson = name.toLowerCase().endsWith('.json') || text.trimStart().startsWith('{');
  if (looksJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('The file could not be read as JSON.');
    }
    return { kind: 'json', data: validateBackup(parsed), fileName: name };
  }
  const { data, skipped } = csvToData(text, existing);
  return { kind: 'csv', data, skipped, fileName: name };
}
