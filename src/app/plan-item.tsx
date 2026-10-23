import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { CategoryInput, DateField, SelectInput } from '@/components/forms';
import { Button, EmptyState, Field, FormScroll, Input, Row, Segmented, T } from '@/components/ui';
import { categorySuggestions } from '@/lib/categories';
import { sortPayments, summarizeDebt } from '@/lib/debt';
import { centsToInput, formatDate, formatMoney, parseMoney, today } from '@/lib/format';
import { findPlanItemPayment, findPlanItemTransaction, newId, useData } from '@/lib/store';
import { colors, space } from '@/lib/theme';
import type { PlanItem, TxType } from '@/lib/types';

export default function PlanItemForm() {
  const params = useLocalSearchParams<{ planId: string; itemId?: string; type?: TxType }>();
  const { data, savePlanItem, deletePlanItem } = useData();
  const currency = data.settings.currency;
  const plan = data.plans.find((p) => p.id === params.planId);
  const existing = plan?.items.find((i) => i.id === params.itemId);
  const recorded = plan && existing ? findPlanItemTransaction(plan, existing, data.transactions) : undefined;
  const recordedIn = data.accounts.find((a) => a.id === recorded?.accountId);
  const paid = existing ? findPlanItemPayment(data, existing) : undefined;

  const [type, setType] = useState<TxType>(existing?.type ?? params.type ?? 'expense');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [date, setDate] = useState<string | undefined>(existing ? existing.date : today());
  const [debtId, setDebtId] = useState<string | undefined>(existing?.debtId);
  const [done, setDone] = useState(existing?.done ?? false);
  const [errors, setErrors] = useState<{ label?: string; amount?: string; date?: string }>({});

  const suggestions = useMemo(() => categorySuggestions(data, type), [data, type]);
  // Open debts, plus the one this item already points at.
  const debts = data.debts.filter((d) => d.id === existing?.debtId || !summarizeDebt(d).paidOff);
  const debt = type === 'expense' ? data.debts.find((d) => d.id === debtId) : undefined;

  if (!plan) return <EmptyState icon="alert-circle-outline" title="Plan not found" />;

  const pickDebt = (id: string | undefined) => {
    setDebtId(id);
    const picked = data.debts.find((d) => d.id === id);
    if (!picked) return;
    // Fill in the obvious parts for a debt payment, without overwriting what's typed.
    if (!label.trim()) setLabel(`${picked.name} payment`);
    if (!category.trim()) setCategory('Debt payment');
    const last = sortPayments(picked.payments).at(-1);
    if (!amount.trim() && last) setAmount(centsToInput(last.amount));
  };

  const save = () => {
    const cents = parseMoney(amount);
    const next = {
      label: label.trim() ? undefined : 'Describe the item.',
      amount: cents === null || cents <= 0 ? 'Enter an amount greater than zero.' : undefined,
      date:
        debt && (date ?? today()) < debt.startDate
          ? `${debt.name} starts on ${formatDate(debt.startDate)}; pick a date on or after it.`
          : undefined,
    };
    setErrors(next);
    if (next.label || next.amount || next.date || cents === null) return;
    const item: PlanItem = {
      id: existing?.id ?? newId(),
      type,
      label: label.trim(),
      amount: cents,
      category: category.trim(),
      done,
      date,
      debtId: debt?.id,
      transactionId: existing?.transactionId,
      debtPaymentId: existing?.debtPaymentId,
    };
    savePlanItem(plan.id, item);
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    const finish = (removeRecorded: boolean) => {
      deletePlanItem(plan.id, existing.id, { removeRecorded });
      router.back();
    };
    if (!recorded && !paid) return finish(false);
    const where = [recorded ? `a transaction in "${recordedIn?.name ?? 'an account'}"` : null, paid ? `a payment on "${paid.debt.name}"` : null]
      .filter(Boolean)
      .join(' and ');
    Alert.alert('Remove from plan?', `Marking this done recorded ${where}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Keep them', onPress: () => finish(false) },
      { text: 'Delete them too', style: 'destructive', onPress: () => finish(true) },
    ]);
  };

  const when = formatDate(date ?? today());
  const amountText = parseMoney(amount) ? formatMoney(parseMoney(amount)!, currency) : 'this amount';

  return (
    <FormScroll contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: existing ? 'Edit item' : type === 'income' ? 'Planned income' : 'Planned expense' }} />

      <Segmented
        options={[
          { key: 'expense', label: 'Expense', icon: 'arrow-up' },
          { key: 'income', label: 'Income', icon: 'arrow-down' },
        ]}
        value={type}
        onChange={setType}
      />

      <Field label="Description" error={errors.label}>
        <Input
          value={label}
          onChangeText={setLabel}
          placeholder={type === 'income' ? 'e.g. Side project payment' : 'e.g. Rent, groceries, phone bill'}
          autoFocus={!existing}
        />
      </Field>

      <Field label="Amount" error={errors.amount}>
        <Input value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
      </Field>

      <View style={{ gap: 6 }}>
        <DateField label="Date" value={date} onChange={setDate} allowClear />
        {errors.date ? (
          <T style={{ color: colors.danger, fontSize: 13 }}>{errors.date}</T>
        ) : (
          <T variant="caption">When it’s planned to happen. Anything recorded when you tick it uses this date{date ? '' : ' (today if empty)'}.</T>
        )}
      </View>

      <Field label="Category">
        <CategoryInput value={category} onChange={setCategory} options={suggestions} />
      </Field>

      {type === 'expense' && debts.length ? (
        <Field label="Pays toward a debt (optional)">
          <SelectInput
            value={debtId}
            onChange={pickDebt}
            options={debts.map((d) => {
              const s = summarizeDebt(d);
              return { id: d.id, label: d.name, detail: s.paidOff ? 'Paid off' : `${formatMoney(s.payoff, currency)} left` };
            })}
            placeholder="Not a debt payment"
            icon="card-outline"
            emptyText="No debt matches that name."
          />
        </Field>
      ) : null}

      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '600' }}>Already done</T>
          <T variant="caption">Counts toward “spent so far” in the plan.</T>
        </View>
        <Switch value={done} onValueChange={setDone} trackColor={{ true: colors.primary, false: colors.surfaceHigh }} thumbColor={colors.text} />
      </Row>

      {debt ? (
        <T variant="caption" style={paid && !done ? { color: colors.expenseText } : undefined}>
          {paid && done
            ? `Added to ${debt.name} as a payment on ${formatDate(paid.payment.date)}. Saving changes here updates it.`
            : paid
              ? `Saving will remove its payment from ${debt.name}.`
              : done
                ? `Saving adds a ${amountText} payment to ${debt.name} on ${when}.`
                : `When you tick this as done, a ${amountText} payment on ${when} is added to ${debt.name}.`}
        </T>
      ) : null}

      {recorded ? (
        <T variant="caption" style={!done ? { color: colors.expenseText } : undefined}>
          {done
            ? `Recorded in ${recordedIn?.name ?? 'an account'} on ${formatDate(recorded.date)}. Saving changes here updates that transaction.`
            : `Saving will remove the transaction recorded in ${recordedIn?.name ?? 'an account'}.`}
        </T>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button title={existing ? 'Save changes' : 'Add to plan'} icon="checkmark" onPress={save} />
        {existing ? <Button title="Remove from plan" kind="danger" icon="trash-outline" onPress={remove} /> : null}
      </View>
    </FormScroll>
  );
}
