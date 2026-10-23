import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/forms';
import { Button, Chip, EmptyState, Field, FormScroll, Input, Row, T } from '@/components/ui';
import { previewPayment, sortPayments } from '@/lib/debt';
import { centsToInput, formatMoney, parseMoney, today } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';

export default function DebtPaymentForm() {
  const params = useLocalSearchParams<{ debtId: string; paymentId?: string }>();
  const { data, saveDebtPayment, deleteDebtPayment } = useData();
  const currency = data.settings.currency;
  const debt = data.debts.find((d) => d.id === params.debtId);
  const existing = debt?.payments.find((p) => p.id === params.paymentId);
  const latest = debt ? sortPayments(debt.payments).at(-1) : undefined;
  const linkedTx = (id?: string) => (id ? data.transactions.find((t) => t.id === id) : undefined);
  const accounts = data.accounts.filter((a) => !a.archived || a.id === linkedTx(existing?.transactionId)?.accountId);

  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : latest ? centsToInput(latest.amount) : '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  // New payments default to the account the previous payment came from.
  const [accountId, setAccountId] = useState<string | null>(
    (existing ? linkedTx(existing.transactionId)?.accountId : linkedTx(latest?.transactionId)?.accountId) ?? null,
  );
  const [error, setError] = useState('');

  const cents = parseMoney(amount);
  const preview = debt && cents !== null && cents > 0 ? previewPayment(debt, cents, date, existing?.id) : null;

  if (!debt) return <EmptyState icon="alert-circle-outline" title="Debt not found" />;
  const hasInterest = debt.method !== 'none' && debt.rate > 0;

  const save = () => {
    if (cents === null || cents <= 0) return setError('Enter an amount greater than zero.');
    if (date < debt.startDate) return setError(`The loan starts on ${debt.startDate}; pick a date on or after it.`);
    saveDebtPayment(debt.id, { amount: cents, date, note: note.trim() || undefined }, { paymentId: existing?.id, accountId });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(
      'Delete payment?',
      existing.transactionId ? 'The matching expense in your account is deleted too.' : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteDebtPayment(debt.id, existing.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <FormScroll contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: existing ? 'Edit payment' : `Pay ${debt.name}` }} />

      <View style={s.amountBox}>
        <T variant="label">Payment amount</T>
        <Input
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            setError('');
          }}
          placeholder="0.00"
          keyboardType="decimal-pad"
          autoFocus={!existing && !latest}
          style={s.amountInput}
          accessibilityLabel="Payment amount"
        />
        {error ? <T style={{ color: colors.danger }}>{error}</T> : null}
      </View>

      <DateField label="Date paid" value={date} onChange={(d) => setDate(d ?? today())} />

      {preview ? (
        <View style={s.preview}>
          {hasInterest ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="muted">
                Interest ({preview.days} day{preview.days === 1 ? '' : 's'})
              </T>
              <T style={{ fontWeight: '600', color: colors.expenseText }}>+{formatMoney(preview.interest, currency)}</T>
            </Row>
          ) : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="muted">Balance after this payment</T>
            <T style={{ fontWeight: '700' }}>{formatMoney(Math.max(0, preview.balance), currency)}</T>
          </Row>
          {preview.balance < -0.5 ? (
            <T variant="caption">That’s {formatMoney(-preview.balance, currency)} more than you owe.</T>
          ) : null}
        </View>
      ) : null}

      <Field label="Also record as an expense in" hint="Optional. Keeps your account balance in sync with what you paid.">
        <View style={s.wrap}>
          <Chip label="Don't record" selected={!accountId} onPress={() => setAccountId(null)} />
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
        </View>
      </Field>

      <Field label="Note">
        <Input value={note} onChangeText={setNote} placeholder="Optional, e.g. receipt number" multiline />
      </Field>

      <View style={{ gap: space.sm }}>
        <Button title={existing ? 'Save changes' : 'Add payment'} icon="checkmark" onPress={save} />
        {existing ? <Button title="Delete payment" kind="danger" icon="trash-outline" onPress={remove} /> : null}
      </View>
    </FormScroll>
  );
}

const s = StyleSheet.create({
  amountBox: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary, padding: space.lg, gap: space.xs },
  amountInput: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    fontVariant: ['tabular-nums'],
  },
  preview: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: space.sm, marginTop: -space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
