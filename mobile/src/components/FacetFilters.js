import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import ChipRow from './ChipRow';
import Field from './Field';
import { colors, radius, spacing, TOUCH_TARGET, type } from '../constants/theme';

/**
 * Search box with a button that opens/closes the filter panel.
 * @param {{ search: string, onSearch: (text: string) => void, placeholder: string, open: boolean, onToggle: () => void, activeCount: number }} props
 */
export function FacetSearchBar({ search, onSearch, placeholder, open, onToggle, activeCount }) {
  return (
    <View style={styles.searchRow}>
      <Field
        containerStyle={styles.searchField}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        value={search}
        onChangeText={onSearch}
        autoCorrect={false}
        returnKeyType="search"
      />
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Filters, ${activeCount} active`}
        style={({ pressed }) => [
          styles.filterBtn,
          (open || activeCount > 0) && styles.filterBtnActive,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="options-outline" size={22} color={colors.primary} />
        {activeCount > 0 ? <Text style={styles.filterCount}>{activeCount}</Text> : null}
      </Pressable>
    </View>
  );
}

/**
 * One chip row per facet, each chip showing its count.
 * @param {{
 *   rows: { key: string, title: string, label?: (value: string) => string }[],
 *   facets: Record<string, { value: string, label: string, count: number }[]>,
 *   filters: Record<string, string>,
 *   onToggle: (key: string, value: string) => void,
 *   onClear: () => void,
 *   isFiltered: boolean,
 * }} props
 */
export function FacetPanel({ rows, facets, filters, onToggle, onClear, isFiltered }) {
  return (
    <View style={styles.filters}>
      {rows.map(({ key, title, label }) => {
        const values = facets[key] || [];
        if (!values.length) return null;
        const labels = Object.fromEntries(
          values.map((f) => [f.value, `${label ? label(f.value) : f.label} (${f.count})`])
        );
        return (
          <View key={key}>
            <Text style={styles.filterLabel}>{title}</Text>
            <ChipRow
              options={['', ...values.map((f) => f.value)]}
              value={filters[key] || ''}
              onSelect={(value) => onToggle(key, value)}
              labels={{ ...labels, '': 'Any' }}
            />
          </View>
        );
      })}
      {isFiltered ? <Button variant="text" title="Clear filters" onPress={onClear} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchField: { flex: 1 },
  filterBtn: {
    minWidth: TOUCH_TARGET,
    height: TOUCH_TARGET,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  pressed: { opacity: 0.8 },
  filterCount: { ...type.caption, color: colors.primary },
  filters: { paddingBottom: spacing.md },
  filterLabel: { ...type.caption, marginTop: spacing.md, marginBottom: spacing.xs },
});
