import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CategoryTotal, MonthPoint } from '@/lib/calc';
import { formatMonth, formatMoney } from '@/lib/format';
import { useCurrency } from '@/lib/store';
import { colors, space } from '@/lib/theme';

import { Row, T } from './ui';

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <T variant="caption">{label}</T>
    </Row>
  );
}

/** Grouped income/expense columns per month. Tapping a month shows its exact values. */
export function MonthlyChart({ points, height = 140 }: { points: MonthPoint[]; height?: number }) {
  const currency = useCurrency();
  const [selected, setSelected] = useState(points.length - 1);
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  const current = points[Math.min(selected, points.length - 1)];

  return (
    <View style={{ gap: space.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={space.md}>
          <LegendItem color={colors.income} label="Income" />
          <LegendItem color={colors.expense} label="Expenses" />
        </Row>
      </Row>
      {current ? (
        <View style={s.readout}>
          <T style={{ fontWeight: '700' }}>{formatMonth(current.key, 'long')}</T>
          <Row gap={space.md} style={{ flexWrap: 'wrap' }}>
            <T variant="muted">In {formatMoney(current.income, currency)}</T>
            <T variant="muted">Out {formatMoney(current.expense, currency)}</T>
            <T variant="muted">Net {formatMoney(current.income - current.expense, currency, { sign: true })}</T>
          </Row>
        </View>
      ) : null}
      <View style={[s.plot, { height }]}>
        {points.map((p, i) => (
          <Pressable
            key={p.key}
            onPress={() => setSelected(i)}
            style={[s.column, i === selected && s.columnSelected]}
            accessibilityRole="button"
            accessibilityLabel={`${formatMonth(p.key, 'long')}: income ${formatMoney(p.income, currency)}, expenses ${formatMoney(p.expense, currency)}`}
          >
            <View style={s.pair}>
              <View style={[s.bar, { height: `${(p.income / max) * 100}%`, backgroundColor: colors.income }]} />
              <View style={[s.bar, { height: `${(p.expense / max) * 100}%`, backgroundColor: colors.expense }]} />
            </View>
          </Pressable>
        ))}
      </View>
      <View style={s.baseline} />
      <Row gap={0}>
        {points.map((p, i) => (
          <T key={p.key} variant="caption" style={[s.monthLabel, i === selected && { color: colors.text, fontWeight: '700' }]}>
            {formatMonth(p.key)}
          </T>
        ))}
      </Row>
    </View>
  );
}

/** Ranked horizontal bars for one series (e.g. spending by category). */
export function CategoryBars({ items, color = colors.primary, limit = 8 }: { items: CategoryTotal[]; color?: string; limit?: number }) {
  const currency = useCurrency();
  const total = items.reduce((s, i) => s + i.total, 0);
  const shown = items.slice(0, limit);
  const rest = items.slice(limit);
  const rows = rest.length
    ? [...shown, { category: `Other (${rest.length})`, total: rest.reduce((s, i) => s + i.total, 0), count: rest.reduce((s, i) => s + i.count, 0) }]
    : shown;
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <View style={{ gap: space.md }}>
      {rows.map((r) => (
        <View key={r.category} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T numberOfLines={1} style={{ flex: 1 }}>
              {r.category}
            </T>
            <T style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatMoney(r.total, currency)}</T>
            <T variant="caption" style={{ width: 40, textAlign: 'right' }}>
              {total ? Math.round((r.total / total) * 100) : 0}%
            </T>
          </Row>
          <View style={s.hTrack}>
            <View style={[s.hBar, { width: `${(r.total / max) * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  readout: { gap: 4, padding: space.md, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', borderRadius: 8, paddingTop: 4 },
  columnSelected: { backgroundColor: colors.primarySoft },
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: '100%' },
  bar: { width: 10, minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  baseline: { height: 1, backgroundColor: colors.border, marginTop: -space.md },
  monthLabel: { flex: 1, textAlign: 'center' },
  hTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  hBar: { height: '100%', borderRadius: 4 },
});
