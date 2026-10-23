import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockScreen } from '@/components/LockScreen';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/store';
import { colors, navTheme } from '@/lib/theme';

SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

function Gate() {
  const { status } = useAuth();
  if (status === 'unlocked') return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LockScreen />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <DataProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '700' },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="account/[id]" options={{ title: 'Account' }} />
              <Stack.Screen name="plan/[id]" options={{ title: 'Plan' }} />
              <Stack.Screen name="account-form" options={{ presentation: 'modal', title: 'Account' }} />
              <Stack.Screen name="transaction-form" options={{ presentation: 'modal', title: 'Transaction' }} />
              <Stack.Screen name="plan-form" options={{ presentation: 'modal', title: 'Plan' }} />
              <Stack.Screen name="plan-item" options={{ presentation: 'modal', title: 'Plan item' }} />
              <Stack.Screen name="transfer-form" options={{ presentation: 'modal', title: 'Transfer' }} />
              <Stack.Screen name="debt/[id]" options={{ title: 'Debt' }} />
              <Stack.Screen name="debt-form" options={{ presentation: 'modal', title: 'Debt' }} />
              <Stack.Screen name="debt-payment" options={{ presentation: 'modal', title: 'Payment' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            </Stack>
            <Gate />
          </AuthProvider>
        </DataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
