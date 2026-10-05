import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../constants/theme';

let MapView = null;
let Marker = null;
try {
  // Optional: may fail in some Expo Go builds
  // eslint-disable-next-line global-require
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch {
  MapView = null;
}

const HYD_CENTER = { latitude: 17.385, longitude: 78.4867 };

export default function ZoneMapPreview({ zones = [], selectedIds = [], height = 180 }) {
  const [mapError, setMapError] = useState(false);

  const pins = useMemo(() => {
    const idSet = new Set(selectedIds.map(String));
    return zones.filter(
      (z) => idSet.has(String(z._id)) && z.lat != null && z.lng != null
    );
  }, [zones, selectedIds]);

  const region = useMemo(() => {
    if (!pins.length) {
      return {
        ...HYD_CENTER,
        latitudeDelta: 0.35,
        longitudeDelta: 0.35,
      };
    }
    const lats = pins.map((p) => p.lat);
    const lngs = pins.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.08, (maxLat - minLat) * 1.8 || 0.12),
      longitudeDelta: Math.max(0.08, (maxLng - minLng) * 1.8 || 0.12),
    };
  }, [pins]);

  if (!pins.length) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>Select zones to preview on the map</Text>
      </View>
    );
  }

  if (!MapView || mapError) {
    return (
      <View style={[styles.fallback, { height: Math.max(height, 120) }]}>
        <Text style={styles.fallbackTitle}>Service areas</Text>
        {pins.map((p) => (
          <Text key={p._id} style={styles.fallbackText}>
            • {p.name} ({p.lat.toFixed(3)}, {p.lng.toFixed(3)})
          </Text>
        ))}
        {!MapView && (
          <Text style={styles.hint}>Map UI unavailable — showing coordinates</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={styles.map}
        initialRegion={region}
        region={region}
        onError={() => setMapError(true)}
        provider={Platform.OS === 'android' ? 'google' : undefined}
      >
        {pins.map((p) => (
          <Marker
            key={p._id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.name}
            description={p.city || 'Hyderabad'}
            pinColor={colors.primary}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  map: { flex: 1 },
  fallback: {
    marginTop: spacing.sm,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    justifyContent: 'center',
  },
  fallbackTitle: {
    ...type.body,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  fallbackText: {
    ...type.secondary,
    color: colors.primary,
    marginBottom: 2,
  },
  hint: {
    ...type.caption,
    marginTop: spacing.sm,
  },
});
