import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, type } from '../constants/theme';

/** Large-title header for tab screens. `right` is an optional action node. */
export default function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text style={type.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.secondary, styles.subtitle]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titles: { flex: 1 },
  subtitle: { marginTop: 2 },
});
