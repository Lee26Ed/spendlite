import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Amount, Button, Card, Chip, EmptyState, Fab, HeroCard, HeroPanel, onHero, ProgressBar, Row, Stat, T } from '@/components/ui';
import { interestLabel, summarizeDebt } from '@/lib/debt';
import { formatDate } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, space } from '@/lib/theme';

export default function DebtsScreen() {
  const { data } = useData();
  const [showPaid, setShowPaid] = useState(false);

  const all = useMemo(
    () =>
      data.debts
        .map((debt) => ({ debt, summary: summarizeDebt(debt) }))
        .sort((a, b) => Number(a.summary.paidOff) - Number(b.summary.paidOff) || b.summary.payoff - a.summary.payoff),
    [data.debts],
  );
  const open = all.filter((x) => !x.summary.paidOff);
  const paidCount = all.length - open.length;
  const list = showPaid ? all : open;
  const owed = open.reduce((s, x) => s + x.summary.payoff, 0);
  const paid = all.reduce((s, x) => s + x.summary.totalPaid, 0);
  const interest = all.reduce((s, x) => s + x.summary.interestCharged, 0);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={list}
        keyExtractor={(x) => x.debt.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 120 }}
        ListHeaderComponent={
          all.length ? (
            <View style={{ gap: space.md, marginBottom: space.sm }}>
              <HeroCard style={{ gap: 4 }}>
                <T variant="label" style={{ color: onHero.muted }}>
                  Still owed
                </T>
                <Amount cents={owed} style={{ fontSize: 34, fontWeight: '800', color: onHero.text }} />
                <T style={{ color: onHero.muted, fontSize: 13 }}>
                  {open.length} open debt{open.length === 1 ? '' : 's'} · includes interest up to today
                </T>
                <HeroPanel style={{ marginTop: space.lg }}>
                  <Stat label="Paid so far" cents={paid} type="income" icon="checkmark-circle-outline" />
                  <Stat label="Interest charged" cents={interest} type="expense" icon="trending-up" />
                </HeroPanel>
              </HeroCard>
              {paidCount ? (
                <Row>
                  <Chip label={`Show paid off (${paidCount})`} icon="checkmark-done" selected={showPaid} onPress={() => setShowPaid((v) => !v)} />
                </Row>
              ) : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          all.length ? (
            <EmptyState icon="checkmark-done-circle-outline" title="All paid off" message="Nice work. Paid-off debts are hidden." />
          ) : (
            <EmptyState
              icon="card-outline"
              title="Track a loan"
              message="Add what you borrowed, any down payment and the interest, then log each payment to see what's paid and what's left."
              action={<Button title="Add a debt" icon="add" onPress={() => router.push('/debt-form')} />}
            />
          )
        }
        renderItem={({ item: { debt, summary } }) => (
          <Card onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })} style={{ gap: space.md }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
                  {debt.name}
                </T>
                <T variant="caption" numberOfLines={1}>
                  {[debt.lender, interestLabel(debt)].filter(Boolean).join(' · ')}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {summary.paidOff ? (
                  <T style={{ fontWeight: '700', color: colors.incomeText }}>Paid off</T>
                ) : (
                  <Amount cents={summary.payoff} style={{ fontSize: 18, fontWeight: '700' }} />
                )}
                <T variant="caption">{summary.paidOff ? '' : 'Left to pay'}</T>
              </View>
            </Row>
            <ProgressBar value={summary.progress} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={4}>
                <T variant="caption">Paid</T>
                <Amount cents={summary.totalPaid} type="income" sign={false} style={{ fontSize: 13 }} />
              </Row>
              <T variant="caption">
                {debt.payments.length ? `Last paid ${formatDate(summary.lastDate)}` : 'No payments yet'}
              </T>
            </Row>
          </Card>
        )}
      />
      {all.length ? <Fab label="Add a debt" onPress={() => router.push('/debt-form')} /> : null}
    </View>
  );
}
