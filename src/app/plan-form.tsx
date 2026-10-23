import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Chip, Field, FormScroll, Input, Row, T } from '@/components/ui';
import { summarizeAccount } from '@/lib/calc';
import { centsToInput, formatMoney, parseMoney } from '@/lib/format';
import { useData } from '@/lib/store';
import { space } from '@/lib/theme';

export default function PlanForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, addPlan, updatePlan, deletePlan } = useData();
  const existing = data.plans.find((p) => p.id === id);
  const accounts = data.accounts.filter((a) => !a.archived);

  const [name, setName] = useState(existing?.name ?? '');
  const [start, setStart] = useState(existing ? centsToInput(existing.startingAmount) : '');
  const [accountId, setAccountId] = useState<string | undefined>(existing?.accountId);
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<{ name?: string; start?: string }>({});

  const linked = accounts.find((a) => a.id === accountId);
  const linkedBalance = linked ? summarizeAccount(linked, data.transactions).balance : null;

  const save = () => {
    const cents = parseMoney(start);
    const next = {
      name: name.trim() ? undefined : 'Give the plan a name.',
      start: cents === null ? 'Enter the amount you are starting with.' : undefined,
    };
    setErrors(next);
    if (next.name || next.start) return;
    const values = { name: name.trim(), startingAmount: cents ?? 0, accountId, note: note.trim() || undefined };
    if (existing) {
      updatePlan(existing.id, values);
      router.back();
    } else {
      const plan = addPlan({ ...values, items: [] });
      router.replace({ pathname: '/plan/[id]', params: { id: plan.id } });
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(`Delete "${existing.name}"?`, 'The plan and its items will be removed. Your transactions are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePlan(existing.id);
          router.dismissTo('/plans');
        },
      },
    ]);
  };

  return (
    <FormScroll contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: existing ? 'Edit plan' : 'New plan' }} />

      <Field label="Plan name" error={errors.name}>
        <Input value={name} onChangeText={setName} placeholder="e.g. November budget, Japan trip" autoFocus={!existing} />
      </Field>

      {accounts.length ? (
        <Field label="Funded from (optional)" hint="Link an account to use its balance as the starting amount and log done items to it.">
          <View style={s.wrap}>
            <Chip label="None" selected={!accountId} onPress={() => setAccountId(undefined)} />
            {accounts.map((a) => (
              <Chip key={a.id} label={a.name} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
            ))}
          </View>
        </Field>
      ) : null}

      <Field label="Starting amount" hint="The money you have to work with for this plan." error={errors.start}>
        <Input value={start} onChangeText={setStart} placeholder="0.00" keyboardType="decimal-pad" />
        {linked && linkedBalance !== null ? (
          <Row>
            <Button
              title={`Use ${linked.name} balance (${formatMoney(linkedBalance, data.settings.currency)})`}
              kind="secondary"
              icon="download-outline"
              style={{ flex: 1 }}
              onPress={() => setStart(centsToInput(linkedBalance))}
            />
          </Row>
        ) : null}
      </Field>

      <Field label="Note">
        <Input value={note} onChangeText={setNote} placeholder="Optional" multiline />
      </Field>

      <View style={{ gap: space.sm }}>
        <Button title={existing ? 'Save changes' : 'Create plan'} icon="checkmark" onPress={save} />
        {existing ? <Button title="Delete plan" kind="danger" icon="trash-outline" onPress={remove} /> : null}
      </View>
      {!existing ? <T variant="caption">Next you’ll add the things you plan to spend on (and any extra income).</T> : null}
    </FormScroll>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
