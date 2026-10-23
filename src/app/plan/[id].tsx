import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Amount, Button, Card, Chip, EmptyState, HeroCard, IconButton, onHero, ProgressBar, Row, Segmented, T } from '@/components/ui';
import { summarizePlan } from '@/lib/calc';
import { today } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';
import type { PlanItem, TxType } from '@/lib/types';

type ItemFilter = 'all' | 'pending' | 'done';
type ItemSort = 'added' | 'amount' | 'name';

const SORT_LABEL: Record<ItemSort, string> = { added: 'Order added', amount: 'Amount', name: 'Name' };
const NEXT_SORT: Record<ItemSort, ItemSort> = { added: 'amount', amount: 'name', name: 'added' };

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, updatePlan, addTransaction } = useData();
  const plan = data.plans.find((p) => p.id === id);
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [sort, setSort] = useState<ItemSort>('added');

  const summary = useMemo(() => (plan ? summarizePlan(plan) : null), [plan]);
  const account = data.accounts.find((a) => a.id === plan?.accountId);

  const items = useMemo(() => {
    if (!plan) return [];
    const list = plan.items.filter((i) => (filter === 'all' ? true : filter === 'done' ? i.done : !i.done));
    if (sort === 'amount') return [...list].sort((a, b) => b.amount - a.amount);
    if (sort === 'name') return [...list].sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [plan, filter, sort]);

  if (!plan || !summary) return <EmptyState icon="alert-circle-outline" title="Plan not found" />;

  const setItems = (next: PlanItem[]) => updatePlan(plan.id, { items: next });
  const openItem = (params: { itemId?: string; type?: TxType }) =>
    router.push({ pathname: '/plan-item', params: { planId: plan.id, ...params } });

  const toggleDone = (item: PlanItem) => {
    const mark = () => setItems(plan.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    if (item.done || !account) return mark();
    Alert.alert('Mark as done', `Also record this ${item.type} in "${account.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Just mark done', onPress: mark },
      {
        text: 'Mark & record',
        onPress: () => {
          mark();
          addTransaction({
            accountId: account.id,
            type: item.type,
            amount: item.amount,
            category: item.category || 'Other',
            note: `${item.label} (plan: ${plan.name})`,
            date: today(),
          });
        },
      },
    ]);
  };

  const expenses = items.filter((i) => i.type === 'expense');
  const incomes = items.filter((i) => i.type === 'income');
  const budget = plan.startingAmount + summary.plannedIncome;
  const over = summary.projectedLeft < 0;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: plan.name,
          headerRight: () => <IconButton icon="create-outline" label="Edit plan" onPress={() => router.push({ pathname: '/plan-form', params: { id: plan.id } })} />,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 64 }}>
        <HeroCard style={{ gap: space.md }}>
          <Line hero label="Starting amount" cents={plan.startingAmount} />
          <Line hero label="Planned income" cents={summary.plannedIncome} prefix="+" />
          <Line hero label="Planned spending" cents={summary.plannedExpense} prefix="−" />
          <View style={[s.divider, { backgroundColor: onHero.muted }]} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={6}>
              {over ? <Ionicons name="warning" size={16} color={onHero.text} /> : null}
              <T style={{ fontWeight: '700', color: onHero.text }}>{over ? 'Over budget by' : 'Left after plan'}</T>
            </Row>
            <Amount cents={Math.abs(summary.projectedLeft)} style={{ fontSize: 22, fontWeight: '800', color: onHero.text }} />
          </Row>
          <ProgressBar
            value={budget > 0 ? summary.plannedExpense / budget : summary.plannedExpense > 0 ? 1 : 0}
            color={onHero.text}
            track={onHero.track}
          />
          <T variant="caption" style={{ color: onHero.muted }}>
            {budget > 0 ? `${Math.round((summary.plannedExpense / budget) * 100)}% of your money is allocated.` : 'Add a starting amount or income to plan against.'}
          </T>
        </HeroCard>

        <Card style={{ gap: space.sm }}>
          <T variant="label">Progress</T>
          <Line label="Spent so far (done)" cents={summary.doneExpense} />
          <Line label="Still to spend" cents={summary.pendingExpense} />
          <Line label="Received so far" cents={summary.doneIncome} />
          <View style={s.divider} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T style={{ fontWeight: '700' }}>Available now</T>
            <Amount cents={summary.currentLeft} style={{ fontSize: 18, fontWeight: '700' }} />
          </Row>
          {account ? <T variant="caption">Linked to {account.name}. Marking items done can record them there.</T> : null}
        </Card>

        <Row>
          <Button title="Expense" icon="remove-circle-outline" kind="secondary" style={{ flex: 1 }} onPress={() => openItem({ type: 'expense' })} />
          <Button title="Income" icon="add-circle-outline" kind="secondary" style={{ flex: 1 }} onPress={() => openItem({ type: 'income' })} />
        </Row>

        {plan.items.length ? (
          <>
            <Segmented
              options={[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'To do' },
                { key: 'done', label: 'Done' },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <Row style={{ justifyContent: 'flex-end' }}>
              <Chip label={`Sort: ${SORT_LABEL[sort]}`} icon="swap-vertical" onPress={() => setSort(NEXT_SORT[sort])} />
            </Row>
          </>
        ) : (
          <EmptyState icon="list-outline" title="No items yet" message="Add what you plan to spend this money on, and any income you expect." />
        )}

        {expenses.length ? <ItemGroup title="Planned spending" items={expenses} onToggle={toggleDone} onEdit={(i) => openItem({ itemId: i.id })} /> : null}
        {incomes.length ? <ItemGroup title="Planned income" items={incomes} onToggle={toggleDone} onEdit={(i) => openItem({ itemId: i.id })} /> : null}
        {plan.items.length && !items.length ? <T variant="muted" style={{ textAlign: 'center' }}>No items in this view.</T> : null}
        {plan.note ? <T variant="muted">{plan.note}</T> : null}
      </ScrollView>

    </View>
  );
}

function Line({ label, cents, prefix, hero }: { label: string; cents: number; prefix?: string; hero?: boolean }) {
  const muted = hero ? { color: onHero.muted } : undefined;
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T variant="muted" style={muted}>
        {label}
      </T>
      <Row gap={2}>
        {prefix ? (
          <T variant="muted" style={muted}>
            {prefix}
          </T>
        ) : null}
        <Amount cents={cents} style={hero && { color: onHero.text }} />
      </Row>
    </Row>
  );
}

function ItemGroup({
  title,
  items,
  onToggle,
  onEdit,
}: {
  title: string;
  items: PlanItem[];
  onToggle: (i: PlanItem) => void;
  onEdit: (i: PlanItem) => void;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <T variant="label">{title}</T>
      <Card style={{ padding: space.xs }}>
        {items.map((item) => (
          <Pressable key={item.id} onPress={() => onEdit(item)} style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.surfaceAlt }]}>
            <Pressable
              hitSlop={10}
              onPress={() => onToggle(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              accessibilityLabel={`Mark ${item.label} ${item.done ? 'not done' : 'done'}`}
            >
              <Ionicons name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={item.done ? colors.primary : colors.textFaint} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <T style={[{ fontWeight: '600' }, item.done && { textDecorationLine: 'line-through', color: colors.textMuted }]} numberOfLines={1}>
                {item.label}
              </T>
              {item.category ? <T variant="caption">{item.category}</T> : null}
            </View>
            <Amount cents={item.amount} type={item.type} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
});
