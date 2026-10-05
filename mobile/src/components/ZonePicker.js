import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, TOUCH_TARGET, type } from '../constants/theme';
import Button from './Button';
import Field from './Field';

/**
 * Combo-style zone dropdown (search + pick).
 * multi=true → Areas served / preferred zones
 * multi=false → single zone (property / listing)
 */
export default function ZonePicker({
  zones = [],
  selectedIds = [],
  onChange,
  multi = true,
  placeholder = 'Select area(s)',
  label,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const selectedZones = useMemo(
    () => zones.filter((z) => selectedSet.has(String(z._id))),
    [zones, selectedSet]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter(
      (z) =>
        z.name?.toLowerCase().includes(q) ||
        z.city?.toLowerCase().includes(q) ||
        z.slug?.toLowerCase().includes(q)
    );
  }, [zones, query]);

  const summary = (() => {
    if (!selectedZones.length) return placeholder;
    if (!multi) return selectedZones[0].name;
    if (selectedZones.length <= 2) return selectedZones.map((z) => z.name).join(', ');
    return `${selectedZones[0].name}, ${selectedZones[1].name} +${selectedZones.length - 2}`;
  })();

  const toggle = (id) => {
    const sid = String(id);
    if (!multi) {
      onChange([id]);
      setOpen(false);
      setQuery('');
      return;
    }
    if (selectedSet.has(sid)) {
      onChange(selectedIds.filter((x) => String(x) !== sid));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <View>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.trigger,
          open && styles.triggerOpen,
          pressed && styles.pressed,
        ]}
        onPress={() => setOpen(true)}
      >
        <Text
          style={[styles.triggerText, !selectedZones.length && styles.triggerPlaceholder]}
          numberOfLines={1}
        >
          {summary}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      {multi && selectedZones.length > 0 ? (
        <View style={styles.selectedRow}>
          {selectedZones.map((z) => (
            <Pressable
              key={z._id}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${z.name}`}
              style={({ pressed }) => [styles.selectedChip, pressed && styles.pressed]}
              onPress={() => toggle(z._id)}
            >
              <Text style={styles.selectedChipText}>{z.name}</Text>
              <Ionicons name="close" size={16} color={colors.onPrimary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* accessible={false} so screen readers can reach the controls inside */}
        <Pressable accessible={false} style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable accessible={false} style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                {multi ? 'Areas served' : 'Select area'}
              </Text>
              <Button variant="text" title="Done" onPress={() => setOpen(false)} />
            </View>

            <Field
              accessibilityLabel="Search areas"
              containerStyle={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search areas…"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {multi ? (
              <View style={styles.actions}>
                <Text style={styles.count}>{selectedIds.length} selected</Text>
                {selectedIds.length > 0 ? (
                  <Button variant="text" title="Clear all" onPress={clearAll} />
                ) : null}
              </View>
            ) : null}

            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item._id)}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>No areas match your search</Text>
              }
              renderItem={({ item }) => {
                const active = selectedSet.has(String(item._id));
                return (
                  <Pressable
                    accessibilityRole={multi ? 'checkbox' : 'radio'}
                    accessibilityState={{ checked: active }}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => toggle(item._id)}
                  >
                    <View style={styles.optionText}>
                      <Text style={[styles.optionName, active && styles.optionNameActive]}>
                        {item.name}
                      </Text>
                      {item.city ? (
                        <Text style={type.secondary}>{item.city}</Text>
                      ) : null}
                    </View>
                    {active ? (
                      <Ionicons name="checkmark" size={22} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** @deprecated alias — use ZonePicker; kept so existing screens keep working */
export function ZoneChipsWrap({ zones, selectedIds, onChange, multi = true, placeholder }) {
  return (
    <ZonePicker
      zones={zones}
      selectedIds={selectedIds}
      onChange={onChange}
      multi={multi}
      placeholder={placeholder || (multi ? 'Select areas served' : 'Select area')}
    />
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  trigger: {
    minHeight: TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  triggerOpen: { borderColor: colors.primary },
  triggerText: { flex: 1, fontSize: 16, color: colors.text },
  triggerPlaceholder: { color: colors.textMuted },
  pressed: { opacity: 0.8 },
  selectedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  selectedChip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  selectedChipText: { flexShrink: 1, color: colors.onPrimary, fontSize: 14, fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    maxHeight: '75%',
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  sheetTitle: { ...type.heading, flex: 1 },
  search: { marginHorizontal: spacing.lg },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    marginTop: spacing.xs,
  },
  count: type.secondary,
  list: { marginTop: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionActive: { backgroundColor: colors.primaryLight },
  optionText: { flex: 1 },
  optionName: type.body,
  optionNameActive: { fontWeight: '600', color: colors.primary },
  empty: { ...type.secondary, textAlign: 'center', padding: spacing.lg },
});
