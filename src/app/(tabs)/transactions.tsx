import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { TransactionList, TxControls } from '@/components/transactions';
import { Button, Card, EmptyState, Fab, Row, Stat, T } from '@/components/ui';
import { totalsOf, withoutTransfers } from '@/lib/calc';
import { applyTxFilter, defaultTxFilter, type TxFilter } from '@/lib/filters';
import { useData } from '@/lib/store';
import { space } from '@/lib/theme';

export default function ActivityScreen() {
  const { data } = useData();
  const [filter, setFilter] = useState<TxFilter>(defaultTxFilter);

  const visible = useMemo(() => applyTxFilter(data.transactions, filter, data.accounts, { collapseTransfers: true }), [data.transactions, data.accounts, filter]);
  // Transfers move money between your own accounts, so they are not money in or out.
  const totals = useMemo(() => totalsOf(withoutTransfers(visible)), [visible]);

  if (!data.accounts.length) {
    return (
      <EmptyState
        icon="list-outline"
        title="Nothing here yet"
        message="Create an account to start recording income and expenses."
        action={<Button title="New account" icon="add" onPress={() => router.push('/account-form')} />}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TransactionList
        txs={visible}
        sort={filter.sort}
        showAccount
        header={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            <TxControls filter={filter} onChange={setFilter} />
            <Card style={{ paddingVertical: space.md }}>
              <Row>
                <Stat label="In" cents={totals.income} type="income" icon="arrow-down" />
                <Stat label="Out" cents={totals.expense} type="expense" icon="arrow-up" />
                <Stat signed label="Net" cents={totals.net} icon="swap-vertical" />
              </Row>
              <T variant="caption" style={{ marginTop: space.sm }}>
                {visible.length} of {data.transactions.length} transactions
              </T>
            </Card>
          </View>
        }
        empty={
          data.transactions.length ? (
            <EmptyState icon="search" title="No matching transactions" message="Try a different search, filter or date range." />
          ) : (
            <EmptyState icon="receipt-outline" title="No transactions yet" message="Tap + to record your first income or expense." />
          )
        }
      />
      <Fab label="Add transaction" onPress={() => router.push('/transaction-form')} />
    </View>
  );
}
