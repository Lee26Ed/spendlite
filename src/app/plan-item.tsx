import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Switch, View } from 'react-native';

import { CategoryInput } from '@/components/forms';
import { Button, EmptyState, Field, FormScroll, Input, Row, Segmented, T } from '@/components/ui';
import { categorySuggestions } from '@/lib/categories';
import { centsToInput, parseMoney } from '@/lib/format';
import { newId, useData } from '@/lib/store';
import { colors, space } from '@/lib/theme';
import type { PlanItem, TxType } from '@/lib/types';

export default function PlanItemForm() {
  const params = useLocalSearchParams<{ planId: string; itemId?: string; type?: TxType }>();
  const { data, updatePlan } = useData();
  const plan = data.plans.find((p) => p.id === params.planId);
  const existing = plan?.items.find((i) => i.id === params.itemId);

  const [type, setType] = useState<TxType>(existing?.type ?? params.type ?? 'expense');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [done, setDone] = useState(existing?.done ?? false);
  const [errors, setErrors] = useState<{ label?: string; amount?: string }>({});

  const suggestions = useMemo(() => categorySuggestions(data, type), [data, type]);

  if (!plan) return <EmptyState icon="alert-circle-outline" title="Plan not found" />;

  const save = () => {
    const cents = parseMoney(amount);
    const next = {
      label: label.trim() ? undefined : 'Describe the item.',
      amount: cents === null || cents <= 0 ? 'Enter an amount greater than zero.' : undefined,
    };
    setErrors(next);
    if (next.label || next.amount || cents === null) return;
    const item: PlanItem = { id: existing?.id ?? newId(), type, label: label.trim(), amount: cents, category: category.trim(), done };
    updatePlan(plan.id, { items: existing ? plan.items.map((i) => (i.id === item.id ? item : i)) : [...plan.items, item] });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    updatePlan(plan.id, { items: plan.items.filter((i) => i.id !== existing.id) });
    router.back();
  };

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

      <Field label="Category">
        <CategoryInput value={category} onChange={setCategory} options={suggestions} />
      </Field>

      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '600' }}>Already done</T>
          <T variant="caption">Counts toward “spent so far” in the plan.</T>
        </View>
        <Switch value={done} onValueChange={setDone} trackColor={{ true: colors.primary, false: colors.surfaceHigh }} thumbColor={colors.text} />
      </Row>

      <View style={{ gap: space.sm }}>
        <Button title={existing ? 'Save changes' : 'Add to plan'} icon="checkmark" onPress={save} />
        {existing ? <Button title="Remove from plan" kind="danger" icon="trash-outline" onPress={remove} /> : null}
      </View>
    </FormScroll>
  );
}
