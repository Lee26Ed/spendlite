import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { kindIcon, kindLabel } from '@/components/accounts';
import { TransactionList, TxControls } from '@/components/transactions';
import { Amount, EmptyState, Fab, HeroCard, HeroPanel, IconButton, onHero, Row, Stat, T } from '@/components/ui';
import { summarizeAccount, totalsOf } from '@/lib/calc';
import { applyTxFilter, countActiveFilters, defaultTxFilter, type TxFilter } from '@/lib/filters';
import { useData } from '@/lib/store';
import { colors, space } from '@/lib/theme';

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData();
  const account = data.accounts.find((a) => a.id === id);
  const [filter, setFilter] = useState<TxFilter>({ ...defaultTxFilter, accountIds: [id] });

  const summary = useMemo(() => (account ? summarizeAccount(account, data.transactions) : null), [account, data.transactions]);
  const visible = useMemo(
    () => applyTxFilter(data.transactions, { ...filter, accountIds: [id] }, data.accounts),
    [data.transactions, data.accounts, filter, id],
  );
  const filtered = filter.search.trim() !== '' || countActiveFilters(filter, true) > 0;
  const visibleTotals = useMemo(() => totalsOf(visible), [visible]);

  if (!account || !summary) {
    return <EmptyState icon="alert-circle-outline" title="Account not found" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: account.name,
          headerRight: () => (
            <Row gap={space.xs}>
              <IconButton
                icon="swap-horizontal"
                label="Transfer from this account"
                onPress={() => router.push({ pathname: '/transfer-form', params: { fromAccountId: account.id } })}
              />
              <IconButton icon="create-outline" label="Edit account" onPress={() => router.push({ pathname: '/account-form', params: { id: account.id } })} />
            </Row>
          ),
        }}
      />
      <TransactionList
        txs={visible}
        sort={filter.sort}
        header={
          <View style={{ gap: space.lg, marginBottom: space.sm }}>
            <HeroCard style={{ gap: space.md }}>
              <Row gap={space.md}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={kindIcon(account.kind)} size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="caption" style={{ color: onHero.muted }}>
                    {kindLabel(account.kind)} · Current balance
                  </T>
                  <Amount cents={summary.balance} style={{ fontSize: 28, fontWeight: '800', color: onHero.text }} />
                </View>
              </Row>
              <HeroPanel>
                <Stat label="Money in" cents={summary.income} type="income" icon="arrow-down" />
                <Stat label="Spent" cents={summary.expense} type="expense" icon="arrow-up" />
                <Stat label="Starting" cents={account.openingBalance} icon="flag-outline" />
              </HeroPanel>
              {account.note ? <T style={{ color: onHero.muted }}>{account.note}</T> : null}
            </HeroCard>
            <TxControls filter={filter} onChange={setFilter} lockedAccountId={account.id} />
            {filtered ? (
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="caption">{visible.length} shown</T>
                <Row gap={space.md}>
                  <Amount cents={visibleTotals.income} type="income" style={{ fontSize: 13 }} />
                  <Amount cents={visibleTotals.expense} type="expense" style={{ fontSize: 13 }} />
                </Row>
              </Row>
            ) : null}
          </View>
        }
        empty={
          summary.count ? (
            <EmptyState icon="search" title="No matching transactions" message="Try a different search or filter." />
          ) : (
            <EmptyState icon="receipt-outline" title="No transactions yet" message="Tap + to record money coming in or going out." />
          )
        }
      />
      <Fab label="Add transaction" onPress={() => router.push({ pathname: '/transaction-form', params: { accountId: account.id } })} />
    </View>
  );
}
