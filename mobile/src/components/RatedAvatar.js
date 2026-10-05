import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ratingColor, starsLabel } from '../constants/rating';
import { colors, type } from '../constants/theme';

/**
 * Circular avatar with a color-coded rating ring (1★ red … 5★ teal).
 */
export default function RatedAvatar({
  uri,
  name = '',
  ratingAvg = 0,
  ratingCount = 0,
  size = 64,
  showLabel = true,
}) {
  const ring = ratingColor(ratingAvg);
  const ringWidth = Math.max(3, Math.round(size * 0.06));
  const inner = size - ringWidth * 2;
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <View style={styles.wrap} accessibilityLabel={`${name}. ${starsLabel(ratingAvg, ratingCount)}`}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ringWidth,
            borderColor: ring,
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: inner, height: inner, borderRadius: inner / 2 }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={[
              styles.placeholder,
              { width: inner, height: inner, borderRadius: inner / 2 },
            ]}
          >
            {initials ? (
              <Text style={[styles.initials, { fontSize: Math.round(size * 0.28) }]}>
                {initials}
              </Text>
            ) : (
              <Ionicons name="person" size={Math.round(size * 0.4)} color={colors.textMuted} />
            )}
          </View>
        )}
      </View>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={[styles.star, { color: ring }]}>★</Text>
          <Text style={styles.label}>
            {ratingCount
              ? `${Number(ratingAvg).toFixed(1)} (${ratingCount})`
              : 'New'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  placeholder: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontWeight: '700', color: colors.primary },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  star: { fontSize: 12, fontWeight: '700' },
  label: { ...type.caption, color: colors.text },
});
