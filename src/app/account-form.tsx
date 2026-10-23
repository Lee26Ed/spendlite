import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ACCOUNT_KINDS } from '@/components/accounts';
import { Button, Chip, Field, FormScroll, Input, Row, T } from '@/components/ui';
import { centsToInput, parseMoney } from '@/lib/format';
import { useData } from '@/lib/store';
import { accountColors, colors, space } from '@/lib/theme';
import type { AccountKind } from '@/lib/types';

export default function AccountForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, addAccount, updateAccount, deleteAccount } = useData();
  const existing = data.accounts.find((a) => a.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(existing?.kind ?? 'bank');
  const [opening, setOpening] = useState(existing ? centsToInput(existing.openingBalance) : '');
  const [color, setColor] = useState(existing?.color ?? accountColors[data.accounts.length % accountColors.length]);
  const [note, setNote] = useState(existing?.note ?? '');
  const [archived, setArchived] = useState(existing?.archived ?? false);
  const [errors, setErrors] = useState<{ name?: string; opening?: string }>({});

  const save = () => {
    const openingBalance = opening.trim() ? parseMoney(opening) : 0;
    const nextErrors = {
      name: name.trim() ? undefined : 'Give the account a name.',
      opening: openingBalance === null ? 'Enter a valid amount.' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.opening) return;
    const values = { name: name.trim(), kind, openingBalance: openingBalance ?? 0, color, note: note.trim() || undefined, archived };
    if (existing) updateAccount(existing.id, values);
    else addAccount(values);
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    const count = data.transactions.filter((t) => t.accountId === existing.id).length;
    Alert.alert(
      `Delete "${existing.name}"?`,
      `This permanently removes the account${count ? ` and its ${count} transaction${count === 1 ? '' : 's'}` : ''}. Consider archiving instead.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteAccount(existing.id);
            router.dismissTo('/');
          },
        },
      ],
    );
  };

  return (
    <FormScroll contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: existing ? 'Edit account' : 'New account' }} />

      <Field label="Name" error={errors.name}>
        <Input value={name} onChangeText={setName} placeholder="e.g. Main bank, Wallet, Travel fund" autoFocus={!existing} />
      </Field>

      <Field label="Type">
        <View style={s.wrap}>
          {ACCOUNT_KINDS.map((k) => (
            <Chip key={k.key} label={k.label} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </View>
      </Field>

      <Field label="Starting balance" hint="How much is already in this account before you start tracking." error={errors.opening}>
        <Input value={opening} onChangeText={setOpening} placeholder="0.00" keyboardType="decimal-pad" />
      </Field>

      <Field label="Color">
        <Row gap={space.md} style={{ flexWrap: 'wrap' }}>
          {accountColors.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityLabel={`Color ${c}`}
              accessibilityState={{ selected: color === c }}
              style={[s.swatch, { backgroundColor: c }, color === c && s.swatchActive]}
            />
          ))}
        </Row>
      </Field>

      <Field label="Note">
        <Input value={note} onChangeText={setNote} placeholder="Optional" multiline />
      </Field>

      {existing ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '600' }}>Archived</T>
            <T variant="caption">Hidden from the accounts list and totals.</T>
          </View>
          <Switch value={archived} onValueChange={setArchived} trackColor={{ true: colors.primary, false: colors.surfaceHigh }} thumbColor="#fff" />
        </Row>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button title={existing ? 'Save changes' : 'Create account'} icon="checkmark" onPress={save} />
        {existing ? <Button title="Delete account" kind="danger" icon="trash-outline" onPress={remove} /> : null}
      </View>
    </FormScroll>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'transparent' },
  swatchActive: { borderColor: '#fff' },
});
