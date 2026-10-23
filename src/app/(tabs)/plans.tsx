import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Amount, Button, Card, EmptyState, Fab, IconButton, Input, OptionList, ProgressBar, Row, Sheet, T } from '@/components/ui';
import { summarizePlan } from '@/lib/calc';
import { formatMoney } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, space } from '@/lib/theme';

type PlanSort = 'recent' | 'name' | 'left-desc' | 'left-asc';

const SORTS: { key: PlanSort; label: string }[] = [
  { key: 'recent', label: 'Recently created' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'left-desc', label: 'Most left over' },
  { key: 'left-asc', label: 'Least left over' },
];

export default function PlansScreen() {
  const { data } = useData();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<PlanSort>('recent');
  const [sortOpen, setSortOpen] = useState(false);

  const plans = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.plans
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.items.some((i) => i.label.toLowerCase().includes(q)))
      .map((p) => ({ plan: p, summary: summarizePlan(p) }));
    const cmp: Record<PlanSort, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      recent: (a, b) => b.plan.createdAt.localeCompare(a.plan.createdAt),
      name: (a, b) => a.plan.name.localeCompare(b.plan.name),
      'left-desc': (a, b) => b.summary.projectedLeft - a.summary.projectedLeft,
      'left-asc': (a, b) => a.summary.projectedLeft - b.summary.projectedLeft,
    };
    return list.sort(cmp[sort]);
  }, [data.plans, search, sort]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={plans}
        keyExtractor={(x) => x.plan.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          data.plans.length ? (
            <View style={{ gap: space.sm, marginBottom: space.sm }}>
              <T variant="muted">Start with an amount, then plan where it goes and see what you will have left.</T>
              <Row>
                <Input value={search} onChangeText={setSearch} placeholder="Search plans" style={{ flex: 1 }} />
                <IconButton icon="swap-vertical" label="Sort plans" onPress={() => setSortOpen(true)} />
              </Row>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          data.plans.length ? (
            <EmptyState icon="search" title="No matching plans" />
          ) : (
            <EmptyState
              icon="clipboard-outline"
              title="Plan your money"
              message="Set a starting amount — like this month's pay — then list what you'll spend it on to see what's left."
              action={<Button title="Create a plan" icon="add" onPress={() => router.push('/plan-form')} />}
            />
          )
        }
        renderItem={({ item: { plan, summary } }) => {
          const budget = plan.startingAmount + summary.plannedIncome;
          const over = summary.projectedLeft < 0;
          return (
            <Card onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })} style={{ gap: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
                    {plan.name}
                  </T>
                  <T variant="caption">
                    {plan.items.length} item{plan.items.length === 1 ? '' : 's'} · starts with{' '}
                    {formatMoney(plan.startingAmount, data.settings.currency)}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Amount cents={summary.projectedLeft} style={{ fontSize: 18, fontWeight: '700', color: over ? colors.danger : colors.text }} />
                  <T variant="caption">{over ? 'Over budget' : 'Left after plan'}</T>
                </View>
              </Row>
              <ProgressBar value={budget > 0 ? summary.plannedExpense / budget : summary.plannedExpense > 0 ? 1 : 0} color={over ? colors.danger : colors.primary} />
            </Card>
          );
        }}
      />
      {data.plans.length ? <Fab label="New plan" onPress={() => router.push('/plan-form')} /> : null}
      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort plans">
        <OptionList
          options={SORTS}
          value={sort}
          onSelect={(k) => {
            setSort(k);
            setSortOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}
