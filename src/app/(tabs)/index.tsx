import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AccountCard } from '@/components/accounts';
import { Amount, Button, Chip, EmptyState, Fab, HeroCard, HeroPanel, IconButton, Input, onHero, OptionList, Row, Sheet, Stat, T } from '@/components/ui';
import { overallSummary, summarizeAccount } from '@/lib/calc';
import { useData } from '@/lib/store';
import { colors, space } from '@/lib/theme';

type AccountSort = 'name' | 'balance-desc' | 'balance-asc' | 'spent-desc' | 'recent';

const SORTS: { key: AccountSort; label: string }[] = [
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'balance-desc', label: 'Balance: high to low' },
  { key: 'balance-asc', label: 'Balance: low to high' },
  { key: 'spent-desc', label: 'Most spent' },
  { key: 'recent', label: 'Recently created' },
];

export default function AccountsScreen() {
  const { data } = useData();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<AccountSort>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = useMemo(() => data.accounts.filter((a) => !a.archived), [data.accounts]);
  const archivedCount = data.accounts.length - active.length;
  const overall = useMemo(() => overallSummary(active, data.transactions), [active, data.transactions]);

  const summaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (showArchived ? data.accounts : active)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.kind.includes(q) || (a.note ?? '').toLowerCase().includes(q))
      .map((a) => summarizeAccount(a, data.transactions));
    const cmp: Record<AccountSort, (x: (typeof list)[number], y: (typeof list)[number]) => number> = {
      name: (x, y) => x.account.name.localeCompare(y.account.name),
      'balance-desc': (x, y) => y.balance - x.balance,
      'balance-asc': (x, y) => x.balance - y.balance,
      'spent-desc': (x, y) => y.expense - x.expense,
      recent: (x, y) => y.account.createdAt.localeCompare(x.account.createdAt),
    };
    return list.sort(cmp[sort]);
  }, [data.accounts, data.transactions, active, search, sort, showArchived]);

  const header = (
    <View style={{ gap: space.lg, marginBottom: space.md }}>
      <HeroCard style={s.hero}>
        <T variant="label" style={{ color: onHero.muted }}>
          Total balance
        </T>
        <Amount cents={overall.balance} style={{ fontSize: 34, fontWeight: '800', color: onHero.text }} />
        <T style={{ color: onHero.muted, fontSize: 13 }}>
          Across {active.length} account{active.length === 1 ? '' : 's'}
        </T>
        <HeroPanel style={{ marginTop: space.lg }}>
          <Stat label="Money in" cents={overall.income} type="income" icon="arrow-down" />
          <Stat label="Spent" cents={overall.expense} type="expense" icon="arrow-up" />
          <Stat label="Starting" cents={overall.opening} icon="flag-outline" />
        </HeroPanel>
      </HeroCard>

      {data.accounts.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Row>
            <Input value={search} onChangeText={setSearch} placeholder="Search accounts" style={{ flex: 1 }} autoCorrect={false} />
            <View style={s.toolButton}>
              <IconButton icon="swap-vertical" label="Sort accounts" onPress={() => setSortOpen(true)} />
            </View>
          </Row>
          {archivedCount > 0 ? (
            <Row>
              <Chip
                label={`Show archived (${archivedCount})`}
                icon="archive-outline"
                selected={showArchived}
                onPress={() => setShowArchived((v) => !v)}
              />
            </Row>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={summaries}
        keyExtractor={(x) => x.account.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120, gap: space.md }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <AccountCard summary={item} onPress={() => router.push({ pathname: '/account/[id]', params: { id: item.account.id } })} />
        )}
        ListEmptyComponent={
          data.accounts.length ? (
            <EmptyState icon="search" title="No matching accounts" />
          ) : (
            <EmptyState
              icon="wallet-outline"
              title="Create your first account"
              message="Add a bank account, cash wallet, card or savings pot to start tracking."
              action={<Button title="New account" icon="add" onPress={() => router.push('/account-form')} />}
            />
          )
        }
        ListFooterComponent={
          data.accounts.length ? (
            <Row style={{ marginTop: space.sm }}>
              <Button title="New account" kind="secondary" icon="add" onPress={() => router.push('/account-form')} style={{ flex: 1 }} />
              {active.length > 1 ? (
                <Button title="Transfer" kind="secondary" icon="swap-horizontal" onPress={() => router.push('/transfer-form')} style={{ flex: 1 }} />
              ) : null}
            </Row>
          ) : undefined
        }
      />
      {data.accounts.length ? <Fab label="Add transaction" onPress={() => router.push('/transaction-form')} /> : null}
      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort accounts">
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

const s = StyleSheet.create({
  hero: { gap: 4, paddingVertical: space.xl },
  toolButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
