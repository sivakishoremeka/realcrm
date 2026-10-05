import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STATUS_COLORS } from '../constants/config';
import { colors, radius } from '../constants/theme';

export default function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || colors.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: color + '1A' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
