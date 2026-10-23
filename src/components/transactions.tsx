import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { allUsedCategories } from '@/lib/categories';
import { countActiveFilters, defaultTxFilter, PERIODS, TX_SORTS, type TxFilter, type TxSort } from '@/lib/filters';
import { formatDayHeader, formatDate } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';
import type { Account, Transaction } from '@/lib/types';

import { DateField } from './forms';
import { Amount, Button, Chip, IconButton, Input, OptionList, Row, Segmented, Sheet, T } from './ui';

export function TransactionRow({ tx, account, showAccount }: { tx: Transaction; account?: Account; showAccount?: boolean }) {
  const income = tx.type === 'income';
  const subtitle = [showAccount ? account?.name : null, tx.note].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/transaction-form', params: { id: tx.id } })}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surfaceAlt }]}
      accessibilityLabel={`${tx.type} ${tx.category} ${(tx.amount / 100).toFixed(2)}`}
    >
      <View style={[s.icon, { backgroundColor: income ? colors.incomeSoft : colors.expenseSoft }]}>
        <Ionicons name={income ? 'arrow-down' : 'arrow-up'} size={18} color={income ? colors.incomeText : colors.expenseText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={1} style={{ fontWeight: '600' }}>
          {tx.category}
        </T>
        {subtitle ? (
          <T variant="caption" numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      <Amount cents={tx.amount} type={tx.type} />
    </Pressable>
  );
}

interface Section {
  title: string;
  data: Transaction[];
}

export function TransactionList({
  txs,
  sort,
  showAccount,
  header,
  empty,
}: {
  txs: Transaction[];
  sort: TxSort;
  showAccount?: boolean;
  header?: ReactElement;
  empty?: ReactElement;
}) {
  const { data } = useData();
  const accounts = useMemo(() => new Map(data.accounts.map((a) => [a.id, a])), [data.accounts]);

  const sections = useMemo<Section[]>(() => {
    if (!txs.length) return [];
    if (sort === 'date-desc' || sort === 'date-asc') {
      const out: Section[] = [];
      for (const t of txs) {
        const last = out[out.length - 1];
        if (last && last.title === t.date) last.data.push(t);
        else out.push({ title: t.date, data: [t] });
      }
      return out;
    }
    return [{ title: '', data: txs }];
  }, [txs, sort]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({ section }) =>
        section.title ? (
          <T variant="label" style={{ marginTop: space.md, marginBottom: space.xs, textTransform: 'none' }}>
            {formatDayHeader(section.title)}
          </T>
        ) : null
      }
      renderItem={({ item }) => (
        <View>
          <TransactionRow tx={item} account={accounts.get(item.accountId)} showAccount={showAccount} />
          {!sections[0]?.title ? (
            <T variant="caption" style={{ marginLeft: 64, marginTop: -6, marginBottom: 6 }}>
              {formatDate(item.date)}
            </T>
          ) : null}
        </View>
      )}
    />
  );
}

/** Search box + filter and sort buttons, with their sheets. */
export function TxControls({
  filter,
  onChange,
  lockedAccountId,
}: {
  filter: TxFilter;
  onChange: (f: TxFilter) => void;
  lockedAccountId?: string;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const active = countActiveFilters(filter, !!lockedAccountId);

  return (
    <View style={{ gap: space.sm }}>
      <Row>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Input
            value={filter.search}
            onChangeText={(search) => onChange({ ...filter, search })}
            placeholder="Search category, note, amount…"
            style={s.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {filter.search ? (
            <IconButton icon="close-circle" label="Clear search" size={18} color={colors.textMuted} onPress={() => onChange({ ...filter, search: '' })} />
          ) : null}
        </View>
        <View style={s.toolButton}>
          <IconButton icon="options-outline" label="Filters" onPress={() => setFilterOpen(true)} badge={active} />
        </View>
        <View style={s.toolButton}>
          <IconButton icon="swap-vertical" label="Sort" onPress={() => setSortOpen(true)} />
        </View>
      </Row>
      <Segmented
        options={[
          { key: 'all', label: 'All' },
          { key: 'income', label: 'Income' },
          { key: 'expense', label: 'Expenses' },
        ]}
        value={filter.type}
        onChange={(type) => onChange({ ...filter, type })}
      />
      {active > 0 ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="caption">
            {active} filter{active > 1 ? 's' : ''} applied · {TX_SORTS.find((x) => x.key === filter.sort)?.label}
          </T>
          <Pressable
            hitSlop={8}
            onPress={() => onChange({ ...defaultTxFilter, search: filter.search, accountIds: lockedAccountId ? [lockedAccountId] : [], sort: filter.sort })}
          >
            <T style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Clear</T>
          </Pressable>
        </Row>
      ) : null}

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        onApply={(f) => {
          onChange(f);
          setFilterOpen(false);
        }}
        lockedAccountId={lockedAccountId}
      />
      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        <OptionList
          options={TX_SORTS}
          value={filter.sort}
          onSelect={(sort) => {
            onChange({ ...filter, sort });
            setSortOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function FilterSheet({
  visible,
  onClose,
  filter,
  onApply,
  lockedAccountId,
}: {
  visible: boolean;
  onClose: () => void;
  filter: TxFilter;
  onApply: (f: TxFilter) => void;
  lockedAccountId?: string;
}) {
  const { data } = useData();
  const [draft, setDraft] = useState(filter);
  const [lastVisible, setLastVisible] = useState(visible);
  // Reset the draft each time the sheet opens.
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setDraft(filter);
  }

  const scoped = lockedAccountId ? data.transactions.filter((t) => t.accountId === lockedAccountId) : data.transactions;
  const categories = allUsedCategories(scoped);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      footer={
        <Row>
          <Button
            title="Reset"
            kind="secondary"
            style={{ flex: 1 }}
            onPress={() => setDraft({ ...defaultTxFilter, search: draft.search, sort: draft.sort, accountIds: lockedAccountId ? [lockedAccountId] : [] })}
          />
          <Button title="Apply" style={{ flex: 2 }} onPress={() => onApply(draft)} />
        </Row>
      }
    >
      <View style={{ gap: space.sm }}>
        <T variant="label">Date range</T>
        <View style={s.wrap}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} selected={draft.period === p.key} onPress={() => setDraft({ ...draft, period: p.key })} />
          ))}
        </View>
        {draft.period === 'custom' ? (
          <Row>
            <View style={{ flex: 1 }}>
              <DateField label="From" value={draft.from} onChange={(from) => setDraft({ ...draft, from })} allowClear />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="To" value={draft.to} onChange={(to) => setDraft({ ...draft, to })} allowClear />
            </View>
          </Row>
        ) : null}
      </View>

      {!lockedAccountId && data.accounts.length > 1 ? (
        <View style={{ gap: space.sm }}>
          <T variant="label">Accounts</T>
          <View style={s.wrap}>
            {data.accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                color={a.color}
                selected={draft.accountIds.includes(a.id)}
                onPress={() => setDraft({ ...draft, accountIds: toggle(draft.accountIds, a.id) })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {categories.length ? (
        <View style={{ gap: space.sm }}>
          <T variant="label">Categories</T>
          <View style={s.wrap}>
            {categories.map((c) => (
              <Chip key={c} label={c} selected={draft.categories.includes(c)} onPress={() => setDraft({ ...draft, categories: toggle(draft.categories, c) })} />
            ))}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: space.xs, borderRadius: radius.md },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: space.md,
    paddingRight: space.xs,
  },
  searchInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: space.sm },
  toolButton: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
