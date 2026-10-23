import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { CategoryInput, DateField } from '@/components/forms';
import { Button, Chip, EmptyState, Field, FormScroll, Input, Segmented, T } from '@/components/ui';
import { categorySuggestions } from '@/lib/categories';
import { centsToInput, parseMoney, today } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';
import type { TxType } from '@/lib/types';

export default function TransactionForm() {
  const params = useLocalSearchParams<{ id?: string; accountId?: string; type?: TxType }>();
  const { data, addTransaction, updateTransaction, deleteTransaction } = useData();
  const existing = data.transactions.find((t) => t.id === params.id);
  const accounts = data.accounts.filter((a) => !a.archived || a.id === existing?.accountId);

  const [type, setType] = useState<TxType>(existing?.type ?? params.type ?? 'expense');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? params.accountId ?? accounts[0]?.id ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  const suggestions = useMemo(() => categorySuggestions(data, type), [data, type]);

  if (!accounts.length) {
    return (
      <EmptyState
        icon="wallet-outline"
        title="No accounts yet"
        message="Create an account first, then record transactions in it."
        action={<Button title="New account" icon="add" onPress={() => router.replace('/account-form')} />}
      />
    );
  }

  const save = () => {
    const cents = parseMoney(amount);
    if (cents === null || cents <= 0) return setError('Enter an amount greater than zero.');
    if (!accountId) return setError('Pick an account.');
    const values = {
      type,
      amount: cents,
      accountId,
      category: category.trim() || 'Other',
      date,
      note: note.trim() || undefined,
    };
    if (existing) updateTransaction(existing.id, values);
    else addTransaction(values);
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTransaction(existing.id);
          router.back();
        },
      },
    ]);
  };

  const accent = type === 'income' ? colors.income : colors.expense;

  return (
    <FormScroll contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: existing ? 'Edit transaction' : 'New transaction' }} />

      <Segmented
        options={[
          { key: 'expense', label: 'Expense', icon: 'arrow-up' },
          { key: 'income', label: 'Income', icon: 'arrow-down' },
        ]}
        value={type}
        onChange={setType}
      />

      <View style={[s.amountBox, { borderColor: accent }]}>
        <T variant="label">{type === 'income' ? 'Amount received' : 'Amount spent'}</T>
        <Input
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            setError('');
          }}
          placeholder="0.00"
          keyboardType="decimal-pad"
          autoFocus={!existing}
          style={s.amountInput}
          accessibilityLabel="Amount"
        />
        {error ? <T style={{ color: colors.danger }}>{error}</T> : null}
      </View>

      <Field label="Account">
        <View style={s.wrap}>
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
        </View>
      </Field>

      <Field label="Category">
        <CategoryInput value={category} onChange={setCategory} options={suggestions} />
      </Field>

      <DateField label="Date" value={date} onChange={(d) => setDate(d ?? today())} />

      <Field label="Note">
        <Input value={note} onChangeText={setNote} placeholder="What was it for?" multiline />
      </Field>

      <View style={{ gap: space.sm }}>
        <Button title={existing ? 'Save changes' : 'Save transaction'} icon="checkmark" onPress={save} />
        {existing ? <Button title="Delete" kind="danger" icon="trash-outline" onPress={remove} /> : null}
      </View>
    </FormScroll>
  );
}

const s = StyleSheet.create({
  amountBox: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.xs },
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
