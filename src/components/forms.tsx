import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { matchCategories } from '@/lib/categories';
import { formatDate, fromISODate, toISODate } from '@/lib/format';
import { colors, radius, space } from '@/lib/theme';

import { Button, Field, Input, Sheet, T } from './ui';

export function DateField({
  label,
  value,
  onChange,
  allowClear,
}: {
  label?: string;
  value?: string;
  onChange: (iso: string | undefined) => void;
  allowClear?: boolean;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(new Date());
  const current = value ? fromISODate(value) : new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onValueChange: (_e, date) => onChange(toISODate(date)),
      });
    } else {
      setIosDraft(current);
      setIosOpen(true);
    }
  };

  return (
    <Field label={label}>
      <Pressable onPress={open} style={s.dateButton} accessibilityRole="button" accessibilityLabel={label ?? 'Date'}>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
        <T style={{ flex: 1, color: value ? colors.text : colors.textFaint }}>{value ? formatDate(value) : 'Any'}</T>
        {allowClear && value ? (
          <Pressable hitSlop={10} onPress={() => onChange(undefined)} accessibilityLabel="Clear date">
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
      {Platform.OS !== 'android' ? (
        <Sheet
          visible={iosOpen}
          onClose={() => setIosOpen(false)}
          title={label ?? 'Pick a date'}
          footer={
            <Button
              title="Done"
              onPress={() => {
                onChange(toISODate(iosDraft));
                setIosOpen(false);
              }}
            />
          }
        >
          <DateTimePicker
            value={iosDraft}
            mode="date"
            display="inline"
            themeVariant="dark"
            accentColor={colors.primary}
            onValueChange={(_e, date) => setIosDraft(date)}
          />
        </Sheet>
      ) : null}
    </Field>
  );
}

/**
 * Free-text category field that remembers past categories: focusing it shows previously used
 * categories, and typing narrows them down. Anything new that is typed becomes a category.
 */
export function CategoryInput({
  value,
  onChange,
  options,
  placeholder = 'e.g. Groceries, Gas, Rent',
}: {
  value: string;
  onChange: (c: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => matchCategories(options, value), [options, value]);

  const pick = (c: string) => {
    onChange(c);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <View style={{ gap: space.xs }}>
      <View>
        <Input
          ref={inputRef}
          value={value}
          onChangeText={(v) => {
            onChange(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder={placeholder}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          style={{ paddingRight: 40 }}
        />
        {value ? (
          <Pressable hitSlop={10} onPress={() => onChange('')} style={s.clear} accessibilityLabel="Clear category">
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {open && matches.length ? (
        <View style={s.dropdown}>
          {matches.map((c, i) => (
            <Pressable
              key={c}
              onPress={() => pick(c)}
              style={({ pressed }) => [s.suggestion, i === matches.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: colors.surfaceHigh }]}
              accessibilityRole="button"
              accessibilityLabel={`Use category ${c}`}
            >
              <Ionicons name="time-outline" size={16} color={colors.textFaint} />
              <T style={{ flex: 1 }} numberOfLines={1}>
                {c}
              </T>
            </Pressable>
          ))}
        </View>
      ) : null}
      {open && !options.length && !value ? (
        <T variant="caption">Type a category. It’ll be suggested here next time.</T>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  clear: { position: 'absolute', right: space.md, top: 0, bottom: 0, justifyContent: 'center' },
  dropdown: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
