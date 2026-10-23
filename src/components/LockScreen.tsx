import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { colors, space } from '@/lib/theme';

import { Button, T } from './ui';

export function LockScreen() {
  const { status, security, unlock } = useAuth();
  const [failed, setFailed] = useState(false);
  const prompting = useRef(false);
  const lastPromptEnded = useRef(0);
  const icon = security.label === 'Face unlock' ? 'scan-outline' : 'finger-print';

  const tryUnlock = async () => {
    if (prompting.current) return;
    prompting.current = true;
    setFailed(false);
    try {
      if (!(await unlock())) setFailed(true);
    } finally {
      prompting.current = false;
      lastPromptEnded.current = Date.now();
    }
  };

  // Prompt as soon as the lock screen appears, and again when the user returns to the app.
  // The system prompt itself can background/foreground the app, so ignore transitions right after one.
  useEffect(() => {
    if (status !== 'locked') return;
    tryUnlock();
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', (state) => {
      const returning = prev === 'background' && state === 'active';
      prev = state;
      if (returning && !prompting.current && Date.now() - lastPromptEnded.current > 1500) tryUnlock();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === 'loading') {
    return (
      <View style={[s.root, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        <T variant="title">SpendLite</T>
        <T variant="muted" style={{ textAlign: 'center' }}>
          {failed ? 'Not recognised. Try again.' : `Use your ${security.label.toLowerCase()} to unlock.`}
        </T>
        <Pressable onPress={tryUnlock} accessibilityRole="button" accessibilityLabel={`Unlock with ${security.label}`}>
          {({ pressed }) => (
            <View style={[s.sensor, pressed && { opacity: 0.8 }]}>
              <Ionicons name={icon} size={64} color={colors.onPrimary} />
            </View>
          )}
        </Pressable>
      </View>
      <Button title="Unlock" icon={icon} onPress={tryUnlock} style={{ marginHorizontal: space.xl }} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingBottom: space.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.xl },
  sensor: { backgroundColor: colors.primary, width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
});
