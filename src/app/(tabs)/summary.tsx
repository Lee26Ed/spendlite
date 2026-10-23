import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AccountBadge } from '@/components/accounts';
import { CategoryBars, MonthlyChart } from '@/components/charts';
import { Amount, Button, Card, Chip, EmptyState, HeroCard, HeroPanel, onHero, ProgressBar, Row, Segmented, Stat, T } from '@/components/ui';
import { categoryBreakdown, monthlySeries, overallSummary, summarizeAccount, totalsOf } from '@/lib/calc';
import { inPeriod, PERIODS, type PeriodKey } from '@/lib/filters';
import { useData } from '@/lib/store';
import { colors, space } from '@/lib/theme';
import type { TxType } from '@/lib/types';

const SUMMARY_PERIODS = PERIODS.filter((p) => p.key !== 'custom');

export default function SummaryScreen() {
  const { data } = useData();
  const [period, setPeriod] = useState<PeriodKey>('this-month');
  const [scope, setScope] = useState<string>('all');
  const [breakdownType, setBreakdownType] = useState<TxType>('expense');

  const accounts = useMemo(() => data.accounts.filter((a) => !a.archived), [data.accounts]);
  const accountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);
  const activeTxs = useMemo(() => data.transactions.filter((t) => accountIds.has(t.accountId)), [data.transactions, accountIds]);
  const periodTxs = useMemo(() => inPeriod(activeTxs, period), [activeTxs, period]);
  const scopedTxs = useMemo(() => (scope === 'all' ? periodTxs : periodTxs.filter((t) => t.accountId === scope)), [periodTxs, scope]);

  const overall = useMemo(() => overallSummary(accounts, data.transactions), [accounts, data.transactions]);
  const periodTotals = useMemo(() => totalsOf(periodTxs), [periodTxs]);
  const months = useMemo(
    () => monthlySeries(scope === 'all' ? activeTxs : activeTxs.filter((t) => t.accountId === scope), 6),
    [activeTxs, scope],
  );
  const breakdown = useMemo(() => categoryBreakdown(scopedTxs, breakdownType), [scopedTxs, breakdownType]);

  const perAccount = useMemo(
    () =>
      accounts.map((a) => {
        const all = summarizeAccount(a, data.transactions);
        const inP = totalsOf(periodTxs.filter((t) => t.accountId === a.id));
        return { account: a, balance: all.balance, ...inP };
      }),
    [accounts, data.transactions, periodTxs],
  );
  const maxFlow = Math.max(1, ...perAccount.flatMap((p) => [p.income, p.expense]));
  const savingsRate = periodTotals.income > 0 ? Math.round((periodTotals.net / periodTotals.income) * 100) : null;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? '';

  if (!accounts.length) {
    return (
      <EmptyState
        icon="pie-chart-outline"
        title="No data to summarize"
        message="Add an account and some transactions to see your summaries."
        action={<Button title="New account" icon="add" onPress={() => router.push('/account-form')} />}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 64 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {SUMMARY_PERIODS.map((p) => (
          <Chip key={p.key} label={p.label} selected={period === p.key} onPress={() => setPeriod(p.key)} />
        ))}
      </ScrollView>

      <HeroCard style={{ gap: space.md }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <T variant="caption" style={{ color: onHero.muted }}>
              Total balance now
            </T>
            <Amount cents={overall.balance} style={{ fontSize: 28, fontWeight: '800', color: onHero.text }} />
          </View>
          {savingsRate !== null ? (
            <View style={{ alignItems: 'flex-end' }}>
              <T variant="caption" style={{ color: onHero.muted }}>
                {savingsRate < 0 ? 'Overspent' : 'Saved'}
              </T>
              <T style={{ fontSize: 20, fontWeight: '700', color: onHero.text }}>{savingsRate}%</T>
            </View>
          ) : null}
        </Row>
        <T variant="label" style={{ color: onHero.muted }}>
          {periodLabel}
        </T>
        <HeroPanel>
          <Stat label="Money in" cents={periodTotals.income} type="income" icon="arrow-down" />
          <Stat label="Spent" cents={periodTotals.expense} type="expense" icon="arrow-up" />
          <Stat signed label="Net" cents={periodTotals.net} icon="swap-vertical" />
        </HeroPanel>
      </HeroCard>

      <View style={{ gap: space.sm }}>
        <T variant="heading">Accounts</T>
        <T variant="caption">Balance is all-time; money in and spent are for {periodLabel.toLowerCase()}.</T>
      </View>
      {perAccount.map((p) => (
        <Card key={p.account.id} style={{ gap: space.md }} onPress={() => router.push({ pathname: '/account/[id]', params: { id: p.account.id } })}>
          <Row gap={space.md}>
            <AccountBadge color={p.account.color} kind={p.account.kind} size={36} />
            <T style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>
              {p.account.name}
            </T>
            <Amount cents={p.balance} style={{ fontSize: 17, fontWeight: '700' }} />
          </Row>
          <View style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="caption">Money in</T>
              <Amount cents={p.income} type="income" sign={false} style={{ fontSize: 13 }} />
            </Row>
            <ProgressBar value={p.income / maxFlow} color={colors.income} />
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <T variant="caption">Spent</T>
              <Amount cents={p.expense} type="expense" sign={false} style={{ fontSize: 13 }} />
            </Row>
            <ProgressBar value={p.expense / maxFlow} color={colors.expense} />
          </View>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="caption">Net for period</T>
            <Amount cents={p.net} sign style={{ fontSize: 14, color: p.net > 0 ? colors.incomeText : p.net < 0 ? colors.expenseText : colors.text }} />
          </Row>
        </Card>
      ))}

      <View style={{ gap: space.sm }}>
        <T variant="heading">Breakdown</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip label="All accounts" selected={scope === 'all'} onPress={() => setScope('all')} />
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} color={a.color} selected={scope === a.id} onPress={() => setScope(a.id)} />
          ))}
        </ScrollView>
      </View>

      <Card style={{ gap: space.md }}>
        <T style={{ fontWeight: '700' }}>Last 6 months</T>
        <MonthlyChart points={months} />
      </Card>

      <Card style={{ gap: space.md }}>
        <Segmented
          options={[
            { key: 'expense', label: 'Spending' },
            { key: 'income', label: 'Income' },
          ]}
          value={breakdownType}
          onChange={setBreakdownType}
        />
        <T variant="caption">By category · {periodLabel}</T>
        {breakdown.length ? (
          <CategoryBars items={breakdown} color={breakdownType === 'income' ? colors.income : colors.expense} />
        ) : (
          <T variant="muted" style={s.none}>
            No {breakdownType === 'income' ? 'income' : 'spending'} in this period.
          </T>
        )}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  none: { textAlign: 'center', paddingVertical: space.lg },
});
