import React, { useCallback, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Card from '../components/Card';
import { formatPrice } from '../components/PriceField';
import ChipRow from '../components/ChipRow';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import ZonePicker from '../components/ZonePicker';
import { LISTING_TYPES, PROPERTY_TYPE_LABELS, PROPERTY_TYPES } from '../constants/config';
// `type` is a state variable in this screen, so the theme scale is aliased.
import { colors, radius, spacing, TOUCH_TARGET, type as typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

const THUMB = 96;
// '' is the "Any" (no filter) value.
const LISTING_OPTIONS = ['', ...LISTING_TYPES];
const TYPE_OPTIONS = ['', ...PROPERTY_TYPES];
const LISTING_LABELS = { '': 'Any' };
const TYPE_LABELS = { ...PROPERTY_TYPE_LABELS, '': 'Any' };

export default function CustomerBrowseScreen({ navigation }) {
  const { logout, user } = useAuth();
  const [items, setItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState(null);
  const [listingType, setListingType] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = {};
      if (zoneId) params.zone = zoneId;
      if (listingType) params.listingType = listingType;
      if (type) params.type = type;
      const [listRes, zonesRes] = await Promise.all([
        api.get('/api/marketplace/listings', { params }),
        zones.length ? Promise.resolve({ data: zones }) : api.get('/api/zones'),
      ]);
      setItems(listRes.data || []);
      if (!zones.length) setZones(zonesRes.data || []);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not load listings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [zoneId, listingType, type])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LoadingOverlay visible={loading} />
      <ScreenHeader
        title="Find a home"
        subtitle={`Hi ${user?.name} · ${items.length} available`}
        right={
          <Pressable
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutPressed]}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
          </Pressable>
        }
      />

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Listing</Text>
        <ChipRow
          options={LISTING_OPTIONS}
          value={listingType}
          onSelect={setListingType}
          labels={LISTING_LABELS}
        />
        <Text style={styles.filterLabel}>Type</Text>
        <ChipRow
          options={TYPE_OPTIONS}
          value={type}
          onSelect={setType}
          labels={TYPE_LABELS}
        />
        <Text style={styles.filterLabel}>Area</Text>
        <ZonePicker
          zones={zones}
          selectedIds={zoneId ? [zoneId] : []}
          onChange={(ids) => setZoneId(ids[0] || null)}
          multi={false}
          placeholder="Any area"
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="search-outline"
              title="No listings match"
              hint="Try clearing filters"
            />
          ) : null
        }
        renderItem={({ item }) => {
          const thumb = item.images?.[0];
          return (
            <Card
              style={styles.card}
              onPress={() =>
                navigation.navigate('CustomerListingDetail', { listingId: item._id })
              }
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPh]}>
                  <Ionicons name="image-outline" size={28} color={colors.primary} />
                </View>
              )}
              <View style={styles.main}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.meta}>
                  {PROPERTY_TYPE_LABELS[item.type] || item.type} · {item.listingType}
                  {item.bhk != null ? ` · ${item.bhk} BHK` : ''}
                </Text>
                <Text style={styles.meta}>{item.zone?.name || 'Hyderabad'}</Text>
                <Text style={styles.price}>{formatPrice(item.price)}</Text>
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  logoutBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutPressed: { backgroundColor: colors.primaryLight },
  filters: { paddingHorizontal: spacing.lg },
  filterLabel: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xs },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.control },
  thumbPh: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1 },
  cardTitle: { ...typography.body, fontWeight: '700' },
  meta: { ...typography.secondary, marginTop: spacing.xs },
  price: { ...typography.body, marginTop: spacing.sm, fontWeight: '700' },
});
