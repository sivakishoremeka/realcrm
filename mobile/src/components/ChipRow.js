import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

/**
 * Single-select row of pill options.
 * @param {{ options: (string|number)[], value: string|number, onSelect: (opt: string|number) => void, labels?: Record<string, string> }} props
 */
export default function ChipRow({ options, value, onSelect, labels }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            hitSlop={4}
            onPress={() => onSelect(opt)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.text, selected && styles.textActive]}>
              {labels?.[opt] || opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  text: { color: colors.text, fontWeight: '500', fontSize: 14 },
  textActive: { color: colors.onPrimary, fontWeight: '600' },
});
