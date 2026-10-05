import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { formatPrice } from '../components/PriceField';
import LoadingOverlay from '../components/LoadingOverlay';
import SwipeableStatusRow from '../components/SwipeableStatusRow';
import { useAuth } from '../context/AuthContext';
import {
  INVENTORY_STATUS_ORDER,
  PROPERTY_TYPE_LABELS,
  STATUS_COLORS,
} from '../constants/config';
import { colors, spacing } from '../constants/theme';
import { sharePropertyOnWhatsApp } from '../utils/whatsappShare';

function sortInventory(list) {
  return [...list].sort((a, b) => {
    const ia = INVENTORY_STATUS_ORDER.indexOf(a.status);
    const ib = INVENTORY_STATUS_ORDER.indexOf(b.status);
    const sa = ia === -1 ? 99 : ia;
    const sb = ib === -1 ? 99 : ib;
    if (sa !== sb) return sa - sb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function typeMeta(item) {
  const label = PROPERTY_TYPE_LABELS[item.type] || item.type;
  const bits = [label, item.listingType];
  if (item.residenceStyle) bits.push(item.residenceStyle);
  if (item.type === 'Apartment' && item.bhk != null) bits.push(`${item.bhk} BHK`);
  if (item.type === 'Villa' && item.villaType) bits.push(item.villaType);
  if (item.type === 'Plot' && item.plotSize) bits.push(item.plotSize);
  if (item.facing) bits.push(`${item.facing} facing`);
  return bits.join(' · ');
}

export default function InventoryScreen({ navigation }) {
  const { logout, user } = useAuth();
  const [items, setItems] = useState([]);
  const [agentPhone, setAgentPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [propsRes, meRes] = await Promise.all([
        api.get('/api/properties'),
        api.get('/api/agents/me').catch(() => ({ data: {} })),
      ]);
      setItems(sortInventory(propsRes.data || []));
      setAgentPhone(meRes.data.phone || '');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const counts = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      map[i.status] = (map[i.status] || 0) + 1;
    });
    return map;
  }, [items]);

  const updateStatus = async (item, status) => {
    if (item.status === status) return;
    try {
      const { data } = await api.patch(`/api/properties/${item._id}/status`, { status });
      setItems((prev) =>
        sortInventory(prev.map((p) => (p._id === item._id ? data : p)))
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not update status');
    }
  };

  const confirmStatus = (item, status, label) => {
    Alert.alert(label, `Mark “${item.title}” as ${status}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, onPress: () => updateStatus(item, status) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LoadingOverlay visible={loading} />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My inventory</Text>
          <Text style={styles.sub}>
            {user?.name} · {items.length} listings
          </Text>
        </View>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.legend}>
        {['Available', 'Deal', 'Blocked', 'Sold'].map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: STATUS_COLORS[s] }]} />
            <Text style={styles.legendText}>
              {s} {counts[s] ? `(${counts[s]})` : ''}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.swipeHint}>Swipe right → Blocked · Swipe left → Deal</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No properties yet</Text>
              <Text style={styles.emptyText}>
                Add inventory so admins can match you to buyers
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const accent = STATUS_COLORS[item.status] || colors.border;
          const thumb = item.images?.[0];
          return (
            <SwipeableStatusRow
              onDeal={() => confirmStatus(item, 'Deal', 'Mark as Deal')}
              onBlocked={() => confirmStatus(item, 'Blocked', 'Mark as Blocked')}
            >
              <View style={[styles.card, { borderLeftColor: accent, borderLeftWidth: 4 }]}>
                <Pressable
                  style={styles.cardBody}
                  onPress={() =>
                    navigation.navigate('PropertyForm', {
                      mode: 'edit',
                      propertyId: item._id,
                    })
                  }
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Text style={styles.thumbPlaceholderText}>No photo</Text>
                    </View>
                  )}
                  <View style={styles.cardMain}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <StatusBadge status={item.status} />
                    </View>
                    <Text style={styles.meta} numberOfLines={2}>
                      {typeMeta(item)}
                    </Text>
                    <Text style={styles.zone}>{item.zone?.name || 'No area'}</Text>
                    <Text style={styles.price}>{formatPrice(item.price)}</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={styles.shareBtn}
                  onPress={() => sharePropertyOnWhatsApp(item, agentPhone)}
                >
                  <Text style={styles.shareText}>WhatsApp</Text>
                </Pressable>
              </View>
            </SwipeableStatusRow>
          );
        }}
      />

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('PropertyForm', { mode: 'create' })}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { color: colors.textMuted, marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.dangerLight,
  },
  logoutText: { color: colors.danger, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  swipeHint: {
    paddingHorizontal: spacing.lg,
    marginTop: 6,
    marginBottom: 4,
    fontSize: 11,
    color: colors.textMuted,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flexDirection: 'row', gap: 12 },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbPlaceholderText: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  cardMain: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text, marginRight: 8 },
  meta: { marginTop: 6, color: colors.textMuted, fontSize: 12 },
  zone: { marginTop: 4, color: colors.primaryDark, fontWeight: '600' },
  price: { marginTop: 6, fontWeight: '800', color: colors.text, fontSize: 16 },
  shareBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#DCF8C6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareText: { color: '#075E54', fontWeight: '700', fontSize: 13 },
  empty: { marginTop: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: {
    marginTop: 6,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 34 },
});
