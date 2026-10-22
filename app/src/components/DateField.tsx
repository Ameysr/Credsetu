import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';
import { formatDate } from '../utils/dates';

interface Props {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

export function DateField({ label, value, onChange, minimumDate }: Props): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  function handleValueChange(_event: DateTimePickerChangeEvent, selected?: Date): void {
    if (Platform.OS !== 'ios') setIsOpen(false);
    if (selected) onChange(selected);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        style={({ pressed }) => [
          styles.input,
          isOpen && styles.inputOpen,
          pressed && styles.inputPressed,
        ]}
        onPress={() => setIsOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value.toISOString())}`}
      >
        <View style={styles.valueRow}>
          <Text style={styles.calendarIcon}>📅</Text>
          <Text style={styles.value}>{formatDate(value.toISOString())}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.action}>{isOpen ? 'Done' : 'Change'}</Text>
        </View>
      </Pressable>

      {isOpen ? (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={value}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={minimumDate}
            themeVariant="dark"
            onValueChange={handleValueChange}
            onDismiss={() => setIsOpen(false)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputOpen: {
    borderColor: colors.borderActive,
  },
  inputPressed: {
    backgroundColor: colors.surface,
    borderColor: colors.borderHighlight,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  calendarIcon: {
    fontSize: fontSize.sm,
    opacity: 0.8,
  },
  value: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  action: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  pickerContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
