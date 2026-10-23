import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Amount, Button, Card, Chip, EmptyState, HeroCard, HeroPanel, IconButton, onHero, ProgressBar, Row, Stat, T } from '@/components/ui';
import { COMPOUNDING, estimatePayoff, interestLabel, summarizeDebt, type ScheduleRow } from '@/lib/debt';
import { formatDate, formatMoney } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';

export default function DebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData();
  const currency = data.settings.currency;
  const debt = data.debts.find((d) => d.id === id);
  const [newestFirst, setNewestFirst] = useState(true);

  const summary = useMemo(() => (debt ? summarizeDebt(debt) : null), [debt]);
  const estimate = useMemo(() => (debt && summary ? estimatePayoff(debt, summary) : null), [debt, summary]);

  if (!debt || !summary) return <EmptyState icon="alert-circle-outline" title="Debt not found" />;

  const rows = newestFirst ? [...summary.rows].reverse() : summary.rows;
  const hasInterest = debt.method !== 'none' && debt.rate > 0;
  const addPayment = () => router.push({ pathname: '/debt-payment', params: { debtId: debt.id } });

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: debt.name,
          headerRight: () => (
            <IconButton icon="create-outline" label="Edit debt" onPress={() => router.push({ pathname: '/debt-form', params: { id: debt.id } })} />
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 64 }}>
        <HeroCard style={{ gap: space.sm }}>
          <T variant="label" style={{ color: onHero.muted }}>
            {summary.paidOff ? 'Paid off' : 'Left to pay today'}
          </T>
          <Amount cents={summary.paidOff ? 0 : summary.payoff} style={{ fontSize: 34, fontWeight: '800', color: onHero.text }} />
          {summary.accrued >= 0.5 ? (
            <T style={{ color: onHero.muted, fontSize: 13 }}>
              Includes {formatMoney(summary.accrued, currency)} interest since {formatDate(summary.lastDate)}
            </T>
          ) : null}
          <ProgressBar value={summary.progress} color={onHero.text} track={onHero.track} />
          <T style={{ color: onHero.muted, fontSize: 13 }}>{Math.round(summary.progress * 100)}% paid off</T>
          <HeroPanel style={{ marginTop: space.sm }}>
            <Stat label="Paid so far" cents={summary.totalPaid} type="income" icon="checkmark-circle-outline" />
            {hasInterest ? <Stat label="Interest" cents={summary.interestCharged} type="expense" icon="trending-up" /> : null}
            <Stat label="Borrowed" cents={debt.principal} icon="flag-outline" />
          </HeroPanel>
        </HeroCard>

        {!summary.paidOff ? <Button title="Add payment" icon="add" onPress={addPayment} /> : null}

        <Card style={{ gap: space.sm }}>
          <Line label="Total amount" value={formatMoney(debt.principal, currency)} />
          {debt.downPayment ? <Line label="Down payment" value={formatMoney(debt.downPayment, currency)} /> : null}
          <Line label="Amount financed" value={formatMoney(summary.financed, currency)} />
          <Line
            label="Interest"
            value={
              interestLabel(debt) +
              (debt.method === 'compound' ? ` (${COMPOUNDING.find((c) => c.key === debt.compounding)?.label.toLowerCase() ?? 'monthly'})` : '') +
              (debt.method === 'simple' ? ` · ${debt.termMonths} months` : '')
            }
          />
          {debt.method === 'simple' && summary.upfrontInterest ? (
            <Line label="Interest added up front" value={formatMoney(summary.upfrontInterest, currency)} />
          ) : null}
          <Line label="Started" value={formatDate(debt.startDate)} />
          {debt.lender ? <Line label="Lender" value={debt.lender} /> : null}
          {estimate ? (
            <T variant="caption" style={{ marginTop: space.xs }}>
              At {formatMoney(estimate.amount, currency)} about every {estimate.everyDays} days, it’s paid off in {estimate.payments} more payment
              {estimate.payments === 1 ? '' : 's'}, around {formatDate(estimate.date)}.
            </T>
          ) : !summary.paidOff && debt.payments.length && hasInterest ? (
            <T variant="caption" style={{ marginTop: space.xs, color: colors.expenseText }}>
              Your latest payment doesn’t cover the interest, so the balance isn’t going down.
            </T>
          ) : null}
          {debt.note ? <T variant="muted">{debt.note}</T> : null}
        </Card>

        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="heading">Payments</T>
          {summary.rows.length > 1 ? (
            <Chip label={newestFirst ? 'Newest first' : 'Oldest first'} icon="swap-vertical" onPress={() => setNewestFirst((v) => !v)} />
          ) : null}
        </Row>

        {rows.length ? (
          <Card style={{ padding: space.xs }}>
            {rows.map((row, i) => (
              <PaymentRow key={row.payment?.id ?? 'down'} row={row} currency={currency} showInterest={hasInterest} last={i === rows.length - 1} debtId={debt.id} />
            ))}
          </Card>
        ) : (
          <EmptyState icon="receipt-outline" title="No payments yet" message="Add each payment you make to track what's left." />
        )}
      </ScrollView>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <T variant="muted">{label}</T>
      <T style={{ flex: 1, textAlign: 'right', fontWeight: '600' }}>{value}</T>
    </Row>
  );
}

function PaymentRow({
  row,
  currency,
  showInterest,
  last,
  debtId,
}: {
  row: ScheduleRow;
  currency: string;
  showInterest: boolean;
  last: boolean;
  debtId: string;
}) {
  const open = () =>
    row.payment
      ? router.push({ pathname: '/debt-payment', params: { debtId, paymentId: row.payment.id } })
      : router.push({ pathname: '/debt-form', params: { id: debtId } });
  const details = [
    row.kind === 'down' ? 'Down payment' : `${row.days} day${row.days === 1 ? '' : 's'}`,
    showInterest && row.kind === 'payment' ? `interest ${formatMoney(row.interest, currency)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable onPress={open} style={({ pressed }) => [s.row, !last && s.rowBorder, pressed && { backgroundColor: colors.surfaceAlt }]}>
      <View style={s.number}>
        <T style={{ fontWeight: '700', fontSize: 13, color: colors.primary }}>{row.kind === 'down' ? '↓' : row.number}</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: '600' }}>{formatDate(row.date)}</T>
        <T variant="caption" numberOfLines={1}>
          {details}
          {row.payment?.note ? ` · ${row.payment.note}` : ''}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Amount cents={row.amount} type="income" sign={false} />
        <T variant="caption">Bal. {formatMoney(Math.max(0, row.balance), currency)}</T>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  number: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
