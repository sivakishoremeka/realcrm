import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { formatPrice } from '../components/PriceField';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import Fab from '../components/Fab';
import { FacetPanel, FacetSearchBar } from '../components/FacetFilters';
import ScreenHeader from '../components/ScreenHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../context/AuthContext';
import useFacetSearch from '../hooks/useFacetSearch';
import { PROPERTY_TYPE_LABELS } from '../constants/config';
import {
  colors,
  radius,
  shadow,
  spacing,
  statusCardColors,
  TOUCH_TARGET,
  type,
} from '../constants/theme';

const THUMB = 48;
const OPTION_MIN_HEIGHT = 56;

// Facet rows, in display order. Keys match GET /api/properties/mine.
const FACET_ROWS = [
  { key: 'postAs', title: 'Posted as', label: (v) => (v === 'owner' ? 'Owner' : 'Agent') },
  { key: 'status', title: 'Status' },
  { key: 'type', title: 'Type', label: (v) => PROPERTY_TYPE_LABELS[v] || v },
  { key: 'listingType', title: 'Listing' },
  { key: 'bhk', title: 'Bedrooms', label: (v) => `${v} BHK` },
  { key: 'zone', title: 'Area' },
];

function ChooserOption({ icon, title, hint, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
    >
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={type.secondary}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function PublisherPostsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const {
    items,
    facets,
    total,
    search,
    setSearch,
    filters,
    toggleFilter,
    clearFilters,
    activeCount,
    isFiltered,
    loading,
    refreshing,
    reload,
  } = useFacetSearch('/api/properties/mine', 'Could not load properties');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LoadingOverlay visible={loading} />
      <ScreenHeader
        title="My properties"
        subtitle={`${user?.name} · ${isFiltered ? `${items.length} of ${total}` : total} properties`}
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

      <FacetSearchBar
        search={search}
        onSearch={setSearch}
        placeholder="Search title, address or area"
        open={filtersOpen}
        onToggle={() => setFiltersOpen((open) => !open)}
        activeCount={activeCount}
      />

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.postAs}-${item._id}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        ListHeaderComponent={
          filtersOpen ? (
            <FacetPanel
              rows={FACET_ROWS}
              facets={facets}
              filters={filters}
              onToggle={toggleFilter}
              onClear={clearFilters}
              isFiltered={isFiltered}
            />
          ) : null
        }
        ListEmptyComponent={
          loading || refreshing ? null : isFiltered ? (
            <EmptyState icon="search-outline" title="No properties match" hint="Try clearing filters" />
          ) : (
            <EmptyState
              icon="home-outline"
              title="No properties yet"
              hint="Post as Agent (inventory) or as Owner (with T&Cs)"
            />
          )
        }
        renderItem={({ item }) => {
          const thumb = item.images?.[0];
          const isOwner = item.postAs === 'owner';
          const tint = statusCardColors[item.status];
          // Status is the card colour; statuses without one are spelled out.
          const meta = [
            PROPERTY_TYPE_LABELS[item.type] || item.type,
            item.listingType,
            item.zone?.name || 'No area',
            tint ? null : item.status,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <Card
              style={[
                styles.card,
                tint && { backgroundColor: tint.background, borderLeftColor: tint.edge },
              ]}
              accessibilityLabel={`${item.title}, ${item.status}, ${formatPrice(item.price)}`}
              onPress={() => {
                if (item.postAs === 'owner') {
                  navigation.navigate('OwnerListingForm', {
                    mode: 'edit',
                    listingId: item._id,
                  });
                } else {
                  navigation.navigate('PropertyForm', {
                    mode: 'edit',
                    propertyId: item._id,
                  });
                }
              }}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPh]}>
                  <Ionicons name="image-outline" size={20} color={colors.primary} />
                </View>
              )}
              <View style={styles.main}>
                <View style={styles.row}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.price}>{formatPrice(item.price)}</Text>
                </View>
                <View style={styles.badgeRow}>
                  <View style={styles.modeBadge}>
                    <Text style={[styles.modeBadgeText, isOwner && styles.ownerBadgeText]}>
                      {isOwner ? 'Owner' : 'Agent'}
                    </Text>
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
              </View>
            </Card>
          );
        }}
      />

      {chooserOpen && (
        <Card style={styles.chooser}>
          <Text style={styles.chooserTitle}>Post property as</Text>
          <ChooserOption
            icon="briefcase-outline"
            title="Agent inventory"
            hint="Matchable stock, Instagram, WhatsApp"
            onPress={() => {
              setChooserOpen(false);
              navigation.navigate('PropertyForm', { mode: 'create' });
            }}
          />
          <ChooserOption
            icon="home-outline"
            title="Property owner"
            hint="T&Cs accept + publish to marketplace"
            onPress={() => {
              setChooserOpen(false);
              navigation.navigate('OwnerListingForm', { mode: 'create' });
            }}
          />
          <Button variant="text" title="Cancel" onPress={() => setChooserOpen(false)} />
        </Card>
      )}

      <Fab onPress={() => setChooserOpen(true)} label="Post a property" />
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: 104 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: spacing.sm },
  thumbPh: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { ...type.secondary, flex: 1, fontWeight: '700', color: colors.text },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  modeBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surface,
  },
  modeBadgeText: { ...type.caption, color: colors.primary },
  ownerBadgeText: { color: colors.accent },
  meta: { ...type.caption, flex: 1, fontWeight: '400' },
  price: { ...type.secondary, fontWeight: '700', color: colors.text },
  chooser: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 96,
    marginBottom: 0,
    ...shadow.raised,
  },
  chooserTitle: { ...type.heading, marginBottom: spacing.sm },
  option: {
    minHeight: OPTION_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
  },
  optionPressed: { backgroundColor: colors.primaryLight },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: { ...type.body, fontWeight: '600' },
});
