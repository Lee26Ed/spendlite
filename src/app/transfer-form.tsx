import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/forms';
import { Amount, Button, Chip, EmptyState, Field, FormScroll, Input, Row, T } from '@/components/ui';
import { summarizeAccount } from '@/lib/calc';
import { centsToInput, parseMoney, today } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';

export default function TransferForm() {
  const params = useLocalSearchParams<{ id?: string; fromAccountId?: string }>();
  const { data, saveTransfer, deleteTransfer } = useData();
  const legs = params.id ? data.transactions.filter((t) => t.transferId === params.id) : [];
  const out = legs.find((t) => t.type === 'expense');
  const into = legs.find((t) => t.type === 'income');
  const existing = out && into ? { out, into } : null;
  const accounts = data.accounts.filter((a) => !a.archived || a.id === out?.accountId || a.id === into?.accountId);

  const [fromId, setFromId] = useState(out?.accountId ?? params.fromAccountId ?? accounts[0]?.id ?? '');
  const [toId, setToId] = useState(into?.accountId ?? accounts.find((a) => a.id !== (params.fromAccountId ?? accounts[0]?.id))?.id ?? '');
  const [amount, setAmount] = useState(out ? centsToInput(out.amount) : '');
  const [date, setDate] = useState(out?.date ?? today());
  const [note, setNote] = useState(out?.note ?? '');
  const [error, setError] = useState('');

  const balances = useMemo(
    () => new Map(accounts.map((a) => [a.id, summarizeAccount(a, data.transactions).balance])),
    [accounts, data.transactions],
  );

  if (accounts.length < 2) {
    return (
      <EmptyState
        icon="swap-horizontal"
        title="You need two accounts"
        message="Create another account to move money between them."
        action={<Button title="New account" icon="add" onPress={() => router.replace('/account-form')} />}
      />
    );
  }

  const save = () => {
    const cents = parseMoney(amount);
    if (cents === null || cents <= 0) return setError('Enter an amount greater than zero.');
    if (!fromId || !toId) return setError('Pick both accounts.');
    if (fromId === toId) return setError('Pick two different accounts.');
    saveTransfer({ fromAccountId: fromId, toAccountId: toId, amount: cents, date, note: note.trim() || undefined }, params.id);
    router.back();
  };

  const remove = () => {
    if (!params.id) return;
    Alert.alert('Delete transfer?', 'The money goes back to how it was in both accounts.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTransfer(params.id!);
          router.back();
        },
      },
    ]);
  };

  const pick = (label: string, value: string, onPick: (id: string) => void, disabledId: string) => (
    <Field label={label}>
      <View style={s.wrap}>
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            color={a.color}
            selected={value === a.id}
            onPress={() => {
              // Picking the account already on the other side swaps them.
              if (a.id === disabledId) {
                setFromId(toId);
                setToId(fromId);
              } else onPick(a.id);
              setError('');
            }}
          />
        ))}
      </View>
      {value ? (
        <Row gap={4}>
          <T variant="caption">Balance</T>
          <Amount cents={balances.get(value) ?? 0} style={{ fontSize: 12, color: colors.textMuted }} />
        </Row>
      ) : null}
    </Field>
  );

  return (
    <FormScroll contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: existing ? 'Edit transfer' : 'Transfer money' }} />

      <View style={s.amountBox}>
        <T variant="label">Amount to move</T>
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

      {pick('From', fromId, setFromId, toId)}
      <View style={{ alignItems: 'center', marginVertical: -space.md }}>
        <Ionicons name="arrow-down-circle" size={28} color={colors.primary} />
      </View>
      {pick('To', toId, setToId, fromId)}

      <DateField label="Date" value={date} onChange={(d) => setDate(d ?? today())} />

      <Field label="Note">
        <Input value={note} onChangeText={setNote} placeholder="Optional" multiline />
      </Field>

      <T variant="caption">Transfers change both account balances but aren’t counted as money in or spending.</T>

      <View style={{ gap: space.sm }}>
        <Button title={existing ? 'Save changes' : 'Transfer'} icon="swap-horizontal" onPress={save} />
        {existing ? <Button title="Delete transfer" kind="danger" icon="trash-outline" onPress={remove} /> : null}
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
