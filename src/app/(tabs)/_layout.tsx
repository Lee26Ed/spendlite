import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { IconButton } from '@/components/ui';
import { colors, space } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName, activeIcon: IconName) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? activeIcon : icon} color={color as string} size={size} />
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        headerShadowVisible: false,
        headerRight: () => (
          <IconButton icon="settings-outline" label="Settings" color={colors.textMuted} onPress={() => router.push('/settings')} />
        ),
        headerRightContainerStyle: { paddingRight: space.md },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Accounts', 'wallet-outline', 'wallet')} />
      <Tabs.Screen name="transactions" options={tab('Activity', 'list-outline', 'list')} />
      <Tabs.Screen name="plans" options={tab('Plans', 'clipboard-outline', 'clipboard')} />
      <Tabs.Screen name="debts" options={tab('Debts', 'card-outline', 'card')} />
      <Tabs.Screen name="summary" options={tab('Summary', 'pie-chart-outline', 'pie-chart')} />
    </Tabs>
  );
}
