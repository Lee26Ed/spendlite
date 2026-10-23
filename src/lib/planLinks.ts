import { today } from './format';
import type { AppData, DebtPayment, Plan, PlanItem, Transaction } from './types';

// A plan item can record things elsewhere once it's done: a transaction in the plan's account and,
// for a planned debt payment, a payment on that debt. These pure helpers keep both in step with
// the item (ticked, edited, un-ticked or removed).

export interface IdSource {
  newId: () => string;
  now: () => string;
}

/** The note written on a transaction recorded from a plan item. */
export const planItemNote = (plan: Pick<Plan, 'name'>, item: Pick<PlanItem, 'label'>) => `${item.label} (plan: ${plan.name})`;

/** The transaction recorded for a done plan item, if it still exists. */
export function findPlanItemTransaction(plan: Plan, item: PlanItem, transactions: Transaction[]) {
  if (item.transactionId) return transactions.find((t) => t.id === item.transactionId);
  if (!item.done || !plan.accountId) return undefined;
  // Items recorded before links were stored: match the note the app wrote at the time.
  const note = planItemNote(plan, item);
  return transactions.find(
    (t) => !t.planId && !t.transferId && !t.debtId && t.accountId === plan.accountId && t.type === item.type && t.amount === item.amount && t.note === note,
  );
}

/** The debt payment added for a done plan item, if it still exists. */
export function findPlanItemPayment(data: Pick<AppData, 'debts'>, item: PlanItem) {
  if (!item.debtId || !item.debtPaymentId) return undefined;
  const debt = data.debts.find((d) => d.id === item.debtId);
  const payment = debt?.payments.find((p) => p.id === item.debtPaymentId);
  return debt && payment ? { debt, payment } : undefined;
}

/**
 * Saves `next` into the plan and brings its recorded transaction and debt payment in line with it.
 * - Done: an existing transaction is updated; a new one is only created with `recordIn` (an account id).
 *   A planned debt payment always gets (or updates) its payment on the debt.
 * - Not done: both are removed.
 */
export function reconcilePlanItem(
  d: AppData,
  planId: string,
  prev: PlanItem | undefined,
  next: PlanItem,
  ids: IdSource,
  opts: { recordIn?: string } = {},
): AppData {
  const plan = d.plans.find((p) => p.id === planId);
  if (!plan) return d;
  const date = next.date ?? today();
  const debt = next.type === 'expense' && next.debtId ? d.debts.find((x) => x.id === next.debtId) : undefined;
  const item: PlanItem = { ...next };
  let transactions = d.transactions;
  let debts = d.debts;

  // 1. Transaction in an account.
  const linkedTx = prev ? findPlanItemTransaction(plan, prev, transactions) : undefined;
  const txFields = {
    type: next.type,
    amount: next.amount,
    category: next.category || (debt ? 'Debt payment' : 'Other'),
    note: planItemNote(plan, next),
    planId,
    debtId: debt?.id,
  };
  if (next.done && linkedTx) {
    transactions = transactions.map((t) => (t.id === linkedTx.id ? { ...t, ...txFields, date: next.date ?? t.date } : t));
    item.transactionId = linkedTx.id;
  } else if (next.done && opts.recordIn) {
    const tx: Transaction = { ...txFields, id: ids.newId(), accountId: opts.recordIn, date, createdAt: ids.now() };
    transactions = [...transactions, tx];
    item.transactionId = tx.id;
  } else {
    if (linkedTx) transactions = transactions.filter((t) => t.id !== linkedTx.id);
    item.transactionId = undefined;
  }

  // 2. Payment on a debt.
  const linkedPay = prev ? findPlanItemPayment(d, prev) : undefined;
  if (linkedPay) {
    debts = debts.map((x) => (x.id === linkedPay.debt.id ? { ...x, payments: x.payments.filter((p) => p.id !== linkedPay.payment.id) } : x));
  }
  if (next.done && debt) {
    // Keep the same payment (and any note added to it on the debt) when it stays on the same debt.
    const payment: DebtPayment = {
      ...(linkedPay?.debt.id === debt.id ? linkedPay.payment : { id: ids.newId(), note: `Plan: ${plan.name}`, createdAt: ids.now() }),
      amount: next.amount,
      date,
      transactionId: item.transactionId,
      planId,
      planItemId: next.id,
    };
    debts = debts.map((x) => (x.id === debt.id ? { ...x, payments: [...x.payments, payment] } : x));
    item.debtPaymentId = payment.id;
  } else {
    item.debtPaymentId = undefined;
  }

  // 3. The item itself.
  const items = plan.items.some((i) => i.id === item.id) ? plan.items.map((i) => (i.id === item.id ? item : i)) : [...plan.items, item];
  return { ...d, transactions, debts, plans: d.plans.map((p) => (p.id === planId ? { ...p, items } : p)) };
}

/**
 * Removes a plan item. With `removeRecorded` its transaction and debt payment are deleted too;
 * otherwise they stay (that money really moved) and just stop pointing at the plan.
 */
export function removePlanItem(d: AppData, planId: string, itemId: string, ids: IdSource, removeRecorded: boolean): AppData {
  const plan = d.plans.find((p) => p.id === planId);
  const item = plan?.items.find((i) => i.id === itemId);
  if (!plan || !item) return d;
  let next = d;
  if (removeRecorded) {
    next = reconcilePlanItem(d, planId, item, { ...item, done: false }, ids);
  } else {
    const tx = findPlanItemTransaction(plan, item, d.transactions);
    const pay = findPlanItemPayment(d, item);
    next = {
      ...d,
      transactions: tx ? d.transactions.map((t) => (t.id === tx.id ? { ...t, planId: undefined } : t)) : d.transactions,
      debts: pay
        ? d.debts.map((x) =>
            x.id === pay.debt.id
              ? { ...x, payments: x.payments.map((p) => (p.id === pay.payment.id ? { ...p, planId: undefined, planItemId: undefined } : p)) }
              : x,
          )
        : d.debts,
    };
  }
  return { ...next, plans: next.plans.map((p) => (p.id === planId ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p)) };
}

/** After a planned debt payment is deleted from the debt, its plan item goes back to not done. */
export function untickForDeletedPayment(d: AppData, payment: DebtPayment): AppData {
  if (!payment.planId || !payment.planItemId) return d;
  return {
    ...d,
    plans: d.plans.map((p) =>
      p.id === payment.planId
        ? {
            ...p,
            items: p.items.map((i) =>
              i.id === payment.planItemId ? { ...i, done: false, debtPaymentId: undefined, transactionId: undefined } : i,
            ),
          }
        : p,
    ),
  };
}

/** After a planned debt payment is edited on the debt, its plan item follows the new amount and date. */
export function syncItemFromPayment(d: AppData, payment: DebtPayment): AppData {
  if (!payment.planId || !payment.planItemId) return d;
  return {
    ...d,
    plans: d.plans.map((p) =>
      p.id === payment.planId
        ? { ...p, items: p.items.map((i) => (i.id === payment.planItemId ? { ...i, amount: payment.amount, date: payment.date } : i)) }
        : p,
    ),
  };
}
