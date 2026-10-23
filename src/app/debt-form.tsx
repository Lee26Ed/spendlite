import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/forms';
import { Amount, Button, Chip, Field, FormScroll, Input, Row, T } from '@/components/ui';
import { COMPOUNDING, INTEREST_METHODS, upfrontInterest } from '@/lib/debt';
import { centsToInput, parseMoney, today } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';
import type { Compounding, InterestMethod } from '@/lib/types';

export default function DebtForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, addDebt, updateDebt, deleteDebt } = useData();
  const existing = data.debts.find((d) => d.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [lender, setLender] = useState(existing?.lender ?? '');
  const [principal, setPrincipal] = useState(existing ? centsToInput(existing.principal) : '');
  const [down, setDown] = useState(existing?.downPayment ? centsToInput(existing.downPayment) : '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today());
  const [method, setMethod] = useState<InterestMethod>(existing?.method ?? 'daily');
  const [rate, setRate] = useState(existing && existing.rate ? String(existing.rate) : '');
  const [compounding, setCompounding] = useState<Compounding>(existing?.compounding ?? 'monthly');
  const [term, setTerm] = useState(existing?.termMonths ? String(existing.termMonths) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const principalCents = parseMoney(principal);
  const downCents = down.trim() ? parseMoney(down) : 0;
  const rateNum = Number(rate.replace(',', '.'));
  const termNum = Number(term);
  const financed = principalCents !== null && downCents !== null ? principalCents - downCents : null;
  const flat =
    method === 'simple' && principalCents && downCents !== null && rateNum > 0 && termNum > 0
      ? upfrontInterest({ method, rate: rateNum, termMonths: termNum, principal: principalCents, downPayment: downCents })
      : 0;

  const save = () => {
    const next = {
      name: name.trim() ? undefined : 'Give the debt a name.',
      principal: principalCents === null || principalCents <= 0 ? 'Enter the total amount borrowed.' : undefined,
      down:
        downCents === null || downCents < 0
          ? 'Enter a valid amount.'
          : principalCents !== null && downCents >= principalCents
            ? 'The down payment must be less than the total.'
            : undefined,
      rate: method !== 'none' && !(rateNum > 0 && rateNum < 1000) ? 'Enter the yearly interest rate, e.g. 3.5.' : undefined,
      term: method === 'simple' && !(Number.isInteger(termNum) && termNum > 0) ? 'Enter the loan length in months.' : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || principalCents === null || downCents === null) return;

    const values = {
      name: name.trim(),
      lender: lender.trim() || undefined,
      principal: principalCents,
      downPayment: downCents,
      startDate,
      method,
      rate: method === 'none' ? 0 : rateNum,
      compounding: method === 'compound' ? compounding : undefined,
      termMonths: method === 'simple' ? termNum : undefined,
      note: note.trim() || undefined,
    };
    if (existing) {
      updateDebt(existing.id, values);
      router.back();
    } else {
      const debt = addDebt({ ...values, payments: [] });
      router.replace({ pathname: '/debt/[id]', params: { id: debt.id } });
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(
      `Delete "${existing.name}"?`,
      'The debt and its payment history are removed. Payments already recorded as expenses in your accounts stay there.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteDebt(existing.id);
            router.dismissTo('/debts');
          },
        },
      ],
    );
  };

  return (
    <FormScroll contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: existing ? 'Edit debt' : 'New debt' }} />

      <Field label="Name" error={errors.name}>
        <Input value={name} onChangeText={setName} placeholder="e.g. Lot 812, Car loan" autoFocus={!existing} />
      </Field>

      <Field label="Lender (optional)">
        <Input value={lender} onChangeText={setLender} placeholder="Who you owe" />
      </Field>

      <Field label="Total amount" hint="The full price or the amount borrowed." error={errors.principal}>
        <Input value={principal} onChangeText={setPrincipal} placeholder="0.00" keyboardType="decimal-pad" />
      </Field>

      <Field label="Down payment (optional)" error={errors.down}>
        <Input value={down} onChangeText={setDown} placeholder="0.00" keyboardType="decimal-pad" />
      </Field>

      <DateField label={downCents ? 'Start date (down payment)' : 'Start date'} value={startDate} onChange={(d) => setStartDate(d ?? today())} />

      {financed !== null && financed > 0 ? (
        <Row style={s.financed}>
          <T variant="muted" style={{ flex: 1 }}>
            Amount financed
          </T>
          <Amount cents={financed} style={{ fontWeight: '700' }} />
        </Row>
      ) : null}

      <Field label="Interest">
        <View style={{ gap: space.sm }}>
          {INTEREST_METHODS.map((m) => {
            const selected = m.key === method;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMethod(m.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[s.method, selected && s.methodSelected]}
              >
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primary : colors.textFaint} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={{ fontWeight: '600' }}>{m.label}</T>
                  <T variant="caption">{m.description}</T>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {method !== 'none' ? (
        <Field label="Interest rate (% per year)" error={errors.rate}>
          <Input value={rate} onChangeText={setRate} placeholder="e.g. 3.5" keyboardType="decimal-pad" />
        </Field>
      ) : null}

      {method === 'compound' ? (
        <Field label="Compounds">
          <Row style={{ flexWrap: 'wrap' }}>
            {COMPOUNDING.map((c) => (
              <Chip key={c.key} label={c.label} selected={compounding === c.key} onPress={() => setCompounding(c.key)} />
            ))}
          </Row>
        </Field>
      ) : null}

      {method === 'simple' ? (
        <Field label="Loan length (months)" error={errors.term}>
          <Input value={term} onChangeText={setTerm} placeholder="e.g. 24" keyboardType="number-pad" />
          {flat > 0 ? (
            <Row gap={4}>
              <T variant="caption">Interest added up front:</T>
              <Amount cents={flat} style={{ fontSize: 12, color: colors.textMuted }} />
            </Row>
          ) : null}
        </Field>
      ) : null}

      <Field label="Note">
        <Input value={note} onChangeText={setNote} placeholder="Optional, e.g. account numbers or terms" multiline />
      </Field>

      <View style={{ gap: space.sm }}>
        <Button title={existing ? 'Save changes' : 'Create debt'} icon="checkmark" onPress={save} />
        {existing ? <Button title="Delete debt" kind="danger" icon="trash-outline" onPress={remove} /> : null}
      </View>
    </FormScroll>
  );
}

const s = StyleSheet.create({
  financed: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginTop: -space.sm },
  method: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
