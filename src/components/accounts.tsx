import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import type { AccountSummary } from '@/lib/calc';
import { colors, space } from '@/lib/theme';
import type { AccountKind } from '@/lib/types';

import { Amount, Card, type IconName, Row, T } from './ui';

export const ACCOUNT_KINDS: { key: AccountKind; label: string; icon: IconName }[] = [
  { key: 'bank', label: 'Bank', icon: 'business-outline' },
  { key: 'cash', label: 'Cash', icon: 'cash-outline' },
  { key: 'card', label: 'Card', icon: 'card-outline' },
  { key: 'savings', label: 'Savings', icon: 'trending-up-outline' },
  { key: 'wallet', label: 'E-wallet', icon: 'phone-portrait-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

export const kindIcon = (k: AccountKind) => ACCOUNT_KINDS.find((x) => x.key === k)?.icon ?? 'wallet-outline';
export const kindLabel = (k: AccountKind) => ACCOUNT_KINDS.find((x) => x.key === k)?.label ?? 'Other';

export function AccountBadge({ color, kind, size = 44 }: { color: string; kind: AccountKind; size?: number }) {
  return (
    <View style={[s.badge, { width: size, height: size, borderRadius: size / 3, backgroundColor: `${color}26` }]}>
      <Ionicons name={kindIcon(kind)} size={size * 0.5} color={color} />
    </View>
  );
}

export function AccountCard({ summary, onPress }: { summary: AccountSummary; onPress: () => void }) {
  const { account, income, expense, balance } = summary;
  return (
    <Card onPress={onPress} style={{ gap: space.md, opacity: account.archived ? 0.6 : 1 }}>
      <Row gap={space.md}>
        <AccountBadge color={account.color} kind={account.kind} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
            {account.name}
          </T>
          <T variant="caption">
            {kindLabel(account.kind)}
            {account.archived ? ' · Archived' : ''} · {summary.count} transaction{summary.count === 1 ? '' : 's'}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Amount cents={balance} style={{ fontSize: 18, fontWeight: '700' }} />
          <T variant="caption">Balance</T>
        </View>
      </Row>
      <Row style={s.footer}>
        <Row gap={4} style={{ flex: 1 }}>
          <Ionicons name="arrow-down" size={14} color={colors.incomeText} />
          <T variant="caption">In </T>
          <Amount cents={income} type="income" sign={false} style={{ fontSize: 13 }} />
        </Row>
        <Row gap={4} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Ionicons name="arrow-up" size={14} color={colors.expenseText} />
          <T variant="caption">Spent </T>
          <Amount cents={expense} type="expense" sign={false} style={{ fontSize: 13 }} />
        </Row>
      </Row>
    </Card>
  );
}

const s = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: space.md },
});
