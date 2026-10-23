import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatMoney } from '@/lib/format';
import { useCurrency } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';
import type { Cents, TxType } from '@/lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Variant = 'title' | 'heading' | 'body' | 'label' | 'muted' | 'caption';

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[styles[variant], style]} />;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/** The main card, filled with the main color. Text on it uses `onHero`; colored figures go in a `HeroPanel`. */
export function HeroCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hero, style]}>{children}</View>;
}

/** Dark inset inside a HeroCard, so green/red figures stay readable. */
export function HeroPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.heroPanel, style]}>{children}</View>;
}

export const onHero = { text: colors.onPrimary, muted: 'rgba(4,32,28,0.72)', track: 'rgba(4,32,28,0.2)' };

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = kind === 'primary' ? colors.onPrimary : kind === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`btn_${kind}`],
        pressed && styles.pressed,
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.text,
  badge,
  size = 22,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  badge?: number;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={size} color={color} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <T variant="label">{label}</T> : null}
      {children}
      {error ? <T style={{ color: colors.danger, fontSize: 13 }}>{error}</T> : hint ? <T variant="caption">{hint}</T> : null}
    </View>
  );
}

export function Input({ style, onFocus, onContentSizeChange, ...rest }: TextInputProps & { ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const reveal = useContext(RevealContext);
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      selectionColor={colors.primary}
      keyboardAppearance="dark"
      {...rest}
      onFocus={(e) => {
        onFocus?.(e);
        reveal?.();
      }}
      onContentSizeChange={(e) => {
        onContentSizeChange?.(e);
        // A growing multiline input keeps its last line above the keyboard.
        if (rest.multiline) reveal?.();
      }}
      style={[styles.input, rest.multiline && { minHeight: 80, textAlignVertical: 'top' }, style]}
    />
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.onPrimary : colors.textMuted} /> : null}
      <Text style={[styles.chipText, selected && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; icon?: IconName }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {o.icon ? <Ionicons name={o.icon} size={16} color={active ? colors.onPrimary : colors.textMuted} /> : null}
            <Text style={[styles.segmentText, active && { color: colors.onPrimary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Amount({
  cents,
  type,
  style,
  sign,
}: {
  cents: Cents;
  type?: TxType;
  style?: TextProps['style'];
  sign?: boolean;
}) {
  const currency = useCurrency();
  const signed = sign ?? !!type;
  const value = !type ? cents : !signed ? Math.abs(cents) : type === 'expense' ? -Math.abs(cents) : Math.abs(cents);
  const color = type === 'income' ? colors.incomeText : type === 'expense' ? colors.expenseText : colors.text;
  return (
    <Text style={[styles.amount, { color }, style]} numberOfLines={1}>
      {formatMoney(value, currency, { sign: signed })}
    </Text>
  );
}

/**
 * A labelled figure. Money in shows green, spent shows red; `signed` colors a net figure by its sign;
 * anything else (e.g. a starting balance) stays in the default text color.
 */
export function Stat({ label, cents, type, icon, signed }: { label: string; cents: Cents; type?: TxType; icon?: IconName; signed?: boolean }) {
  const tone = type ?? (signed && cents > 0 ? 'income' : signed && cents < 0 ? 'expense' : undefined);
  const color = tone === 'income' ? colors.incomeText : tone === 'expense' ? colors.expenseText : colors.text;
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Row gap={6}>
        {icon ? <Ionicons name={icon} size={14} color={tone ? color : colors.textMuted} /> : null}
        <T variant="caption">{label}</T>
      </Row>
      <Amount cents={cents} type={type} sign={signed} style={{ fontSize: 16, color }} />
    </View>
  );
}

const RevealContext = createContext<(() => void) | null>(null);

/**
 * A ScrollView for forms that keeps the focused input above the on-screen keyboard and lets you
 * scroll to everything (including the submit button) while the keyboard is open. Works in Expo Go,
 * on iOS and on Android edge-to-edge, where the window no longer resizes for the keyboard.
 */
export function FormScroll({ children, contentContainerStyle }: { children: ReactNode; contentContainerStyle?: StyleProp<ViewStyle> }) {
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsetY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);

  const reveal = useCallback(() => {
    // Wait a frame or two so the extra bottom space is laid out before scrolling into it.
    setTimeout(() => {
      const top = keyboardTop.current;
      const input = TextInput.State.currentlyFocusedInput();
      if (top === null || !input || !scrollRef.current) return;
      input.measureInWindow((_x, y, _w, h) => {
        const visibleBottom = top - space.lg;
        if (y + h > visibleBottom) {
          // Tall inputs: show their top rather than pushing it off-screen.
          const delta = Math.min(y + h - visibleBottom, Math.max(0, y - 120));
          scrollRef.current?.scrollTo({ y: offsetY.current + delta, animated: true });
        }
      });
    }, 80);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      // Only pad by the part of this view the keyboard actually covers (0 if the window already resized).
      containerRef.current?.measureInWindow((_x, y, _w, h) => {
        setKeyboardOverlap(Math.max(0, y + h - e.endCoordinates.screenY));
        reveal();
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardTop.current = null;
      setKeyboardOverlap(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [reveal]);

  return (
    <RevealContext.Provider value={reveal}>
      <View ref={containerRef} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => {
            offsetY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={contentContainerStyle}
        >
          {children}
          <View style={{ height: keyboardOverlap }} />
        </ScrollView>
      </View>
    </RevealContext.Provider>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm }}>
      <T variant="heading">{title}</T>
      {action}
    </Row>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <T variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {message ? <T variant="muted" style={{ textAlign: 'center' }}>{message}</T> : null}
      {action}
    </View>
  );
}

export function Fab({ onPress, icon = 'add', label }: { onPress: () => void; icon?: IconName; label: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom: space.lg + Math.max(0, insets.bottom - 30) }, pressed && { transform: [{ scale: 0.96 }] }]}
    >
      <Ionicons name={icon} size={28} color={colors.onPrimary} />
    </Pressable>
  );
}

export function ProgressBar({ value, color = colors.primary, track = colors.surfaceHigh }: { value: number; color?: string; track?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.progressTrack, { backgroundColor: track }]}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
          <View style={styles.grabber} />
          <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
            <T variant="heading">{title}</T>
            <IconButton icon="close" label="Close" onPress={onClose} color={colors.textMuted} />
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.sm }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ marginTop: space.md }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function OptionList<K extends string>({
  options,
  value,
  onSelect,
}: {
  options: { key: K; label: string }[];
  value: K;
  onSelect: (k: K) => void;
}) {
  return (
    <View style={{ gap: 2 }}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onSelect(o.key)}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          accessibilityRole="radio"
          accessibilityState={{ checked: o.key === value }}
        >
          <T style={o.key === value && { color: colors.primary, fontWeight: '600' }}>{o.label}</T>
          {o.key === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  muted: { color: colors.textMuted, fontSize: 14 },
  caption: { color: colors.textMuted, fontSize: 12 },
  hero: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: space.lg },
  heroPanel: { flexDirection: 'row', gap: space.md, backgroundColor: colors.bg, borderRadius: 14, padding: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
  },
  pressed: { opacity: 0.75 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  btn_primary: { backgroundColor: colors.primary },
  btn_secondary: { backgroundColor: colors.primarySoft },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_danger: { backgroundColor: colors.dangerSoft },
  buttonText: { fontSize: 16, fontWeight: '600' },
  iconButton: { padding: 6, borderRadius: radius.pill },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '700' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: space.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  amount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: 48, paddingHorizontal: space.xl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: space.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space.md },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: space.sm, borderRadius: radius.sm },
});
