import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip, type IconName, Row, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { exportCsv, exportJson, pickImportFile } from '@/lib/backup';
import { CURRENCIES } from '@/lib/format';
import { useData } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';
import type { LockTimeout } from '@/lib/types';

const TIMEOUTS: { key: LockTimeout; label: string }[] = [
  { key: 0, label: 'Immediately' },
  { key: 30, label: '30 sec' },
  { key: 60, label: '1 min' },
  { key: 300, label: '5 min' },
];

export default function SettingsScreen() {
  const auth = useAuth();
  const store = useData();
  const { data, updateSettings } = store;
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await auth.withoutAutoLock(fn);
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const importData = () =>
    run('import', async () => {
      const result = await pickImportFile(data);
      if (!result) return;
      if (result.kind === 'csv') {
        const counts = store.mergeIn(result.data);
        Alert.alert(
          'Import complete',
          `Added ${counts.transactions} transaction${counts.transactions === 1 ? '' : 's'}` +
            (counts.accounts ? ` and ${counts.accounts} new account${counts.accounts === 1 ? '' : 's'}` : '') +
            (result.skipped ? `. Skipped ${result.skipped} duplicate or invalid row${result.skipped === 1 ? '' : 's'}.` : '.'),
        );
        return;
      }
      const incoming = result.data;
      Alert.alert(
        'Import backup',
        `${result.fileName} has ${incoming.accounts.length} accounts, ${incoming.transactions.length} transactions, ${incoming.plans.length} plans and ${incoming.debts.length} debts.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Merge',
            onPress: () => {
              const c = store.mergeIn(incoming);
              Alert.alert('Merged', `Added ${c.accounts} accounts, ${c.transactions} transactions, ${c.plans} plans and ${c.debts} debts.`);
            },
          },
          {
            text: 'Replace all',
            style: 'destructive',
            onPress: () =>
              Alert.alert('Replace everything?', 'All current data on this device will be overwritten by the backup.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Replace', style: 'destructive', onPress: () => store.replaceAll(incoming) },
              ]),
          },
        ],
      );
    });

  const eraseAll = () =>
    Alert.alert('Erase all data?', 'Every account, transaction, plan and debt will be deleted from this device. Export a backup first if you might need it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase', style: 'destructive', onPress: store.wipe },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 64 }}>
      <Section title="Security">
        {auth.security.secured ? (
          <Item
            icon={auth.security.label === 'Face unlock' ? 'scan-outline' : 'finger-print'}
            title={`Locked with your ${auth.security.biometrics ? auth.security.label.toLowerCase() : 'screen lock'}`}
            subtitle="SpendLite uses your phone's own fingerprint unlock. Manage fingerprints in your device settings."
          />
        ) : (
          <Item
            icon="warning-outline"
            title="Not protected"
            subtitle="This phone has no fingerprint or screen lock, so SpendLite opens without unlocking. Add a fingerprint in your device settings, then restart the app."
            danger
          />
        )}
        <View style={s.item}>
          <Ionicons name="timer-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: space.sm }}>
            <T style={{ fontWeight: '600' }}>Auto-lock</T>
            <Row style={{ flexWrap: 'wrap' }}>
              {TIMEOUTS.map((t) => (
                <Chip key={t.key} label={t.label} selected={data.settings.lockTimeout === t.key} onPress={() => updateSettings({ lockTimeout: t.key })} />
              ))}
            </Row>
          </View>
        </View>
        <Item icon="lock-closed-outline" title="Lock now" onPress={auth.lock} chevron />
      </Section>

      <Section title="Currency">
        <View style={[s.item, { flexWrap: 'wrap', flexDirection: 'row', gap: space.sm }]}>
          {CURRENCIES.map((c) => (
            <Chip key={c} label={c} selected={data.settings.currency === c} onPress={() => updateSettings({ currency: c })} />
          ))}
        </View>
      </Section>

      <Section title="Your data">
        <Item
          icon="cloud-download-outline"
          title="Export backup (JSON)"
          subtitle="Everything: accounts, transactions, plans, debts and settings."
          onPress={() => run('json', () => exportJson(data))}
          busy={busy === 'json'}
        />
        <Item
          icon="document-text-outline"
          title="Export transactions (CSV)"
          subtitle="Open in Excel, Numbers or Google Sheets."
          onPress={() => run('csv', () => exportCsv(data))}
          busy={busy === 'csv'}
        />
        <Item
          icon="cloud-upload-outline"
          title="Import data"
          subtitle="A SpendLite JSON backup, or a CSV with date, account, type, category, amount, note columns."
          onPress={importData}
          busy={busy === 'import'}
        />
        <Item icon="trash-outline" title="Erase all data" onPress={eraseAll} danger />
      </Section>

      <T variant="caption" style={{ textAlign: 'center' }}>
        SpendLite {Constants.expoConfig?.version ?? ''} · {data.accounts.length} accounts · {data.transactions.length} transactions · {data.plans.length} plans
        {'\n'}All data stays on this device.
      </T>

    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T variant="label">{title}</T>
      <View style={s.section}>{children}</View>
    </View>
  );
}

function Item({
  icon,
  title,
  subtitle,
  onPress,
  children,
  chevron,
  danger,
  busy,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  children?: ReactNode;
  chevron?: boolean;
  danger?: boolean;
  busy?: boolean;
}) {
  const tint = danger ? colors.danger : colors.primary;
  return (
    <Pressable onPress={onPress} disabled={!onPress || busy} style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.surfaceAlt }]}>
      <Ionicons name={icon} size={22} color={tint} />
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: '600', color: danger ? colors.danger : colors.text }}>{title}</T>
        {subtitle ? <T variant="caption">{subtitle}</T> : null}
      </View>
      {busy ? <T variant="caption">Working…</T> : children}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
