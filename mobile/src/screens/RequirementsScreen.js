import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import Fab from '../components/Fab';
import { FacetPanel, FacetSearchBar } from '../components/FacetFilters';
import Field from '../components/Field';
import { formatPrice } from '../components/PriceField';
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

const ACTION_SIZE = 36;
const STAGE_LABELS = { Sent: 'Sent to others' };

// Facet rows, in display order. Keys match GET /api/requirements/search.
const FACET_ROWS = [
  { key: 'stage', title: 'Stage', label: (v) => STAGE_LABELS[v] || v },
  { key: 'read', title: 'Read' },
  { key: 'listingType', title: 'Listing' },
  { key: 'propertyType', title: 'Type', label: (v) => PROPERTY_TYPE_LABELS[v] || v },
  { key: 'zone', title: 'Area' },
];

function formatBudget(min, max) {
  if (min && max) return `${formatPrice(min)} – ${formatPrice(max)}`;
  if (max) return `Up to ${formatPrice(max)}`;
  if (min) return `From ${formatPrice(min)}`;
  return 'Budget open';
}

function CardAction({ icon, label, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
}

export default function RequirementsScreen({ navigation }) {
  const { logout, user } = useAuth();
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
  } = useFacetSearch('/api/requirements/search', 'Could not load leads');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Lead the follow-up comment box is open for
  const [followUpFor, setFollowUpFor] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const markRead = async (item) => {
    try {
      await api.post(`/api/requirements/${item._id}/read`);
      reload();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not mark as read');
    }
  };

  const openLead = (item) => {
    // Opening a lead counts as reading it; the list reloads when you come back.
    if (!item.isRead) api.post(`/api/requirements/${item._id}/read`).catch(() => {});
    navigation.navigate('RequirementDetail', { requirementId: item._id });
  };

  const openFollowUp = (item) => {
    if (!item.customer?._id) {
      Alert.alert('No buyer', 'This lead has no buyer record to attach a follow-up to.');
      return;
    }
    setComment('');
    setFollowUpFor(item);
  };

  const saveFollowUp = async () => {
    if (!comment.trim()) {
      Alert.alert('Comment', 'Write a short follow-up comment first.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/interactions', {
        customer: followUpFor.customer._id,
        requirement: followUpFor._id,
        type: 'FollowUp',
        notes: comment.trim(),
      });
      // The comment is saved; a failed mark-read must not look like a failed save.
      if (!followUpFor.isRead) {
        await api.post(`/api/requirements/${followUpFor._id}/read`).catch(() => {});
      }
      setFollowUpFor(null);
      reload();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save follow-up');
    } finally {
      setSaving(false);
    }
  };

  const noun = user?.role === 'admin' ? 'requirements' : 'leads';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LoadingOverlay visible={loading} />
      <ScreenHeader
        title={user?.role === 'admin' ? 'Buyer requirements' : 'My leads'}
        subtitle={`${isFiltered ? `${items.length} of ${total}` : total} ${noun}`}
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
        placeholder="Search buyer, phone, area or notes"
        open={filtersOpen}
        onToggle={() => setFiltersOpen((open) => !open)}
        activeCount={activeCount}
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
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
            <EmptyState icon="search-outline" title={`No ${noun} match`} hint="Try clearing filters" />
          ) : (
            <EmptyState
              icon="clipboard-outline"
              title={`No ${noun} yet`}
              hint="Capture a buyer need to find matching agents"
            />
          )
        }
        renderItem={({ item }) => {
          const tint = statusCardColors[item.stage];
          const name = item.customer?.name || 'Buyer';
          const hasBhk = item.bhkMin || item.bhkMax;
          // Stage is the card colour; stages without one (except New) are spelled out.
          const meta = [
            PROPERTY_TYPE_LABELS[item.propertyType] || item.propertyType,
            item.listingType,
            hasBhk ? `${item.bhkMin || '?'}–${item.bhkMax || '?'} BHK` : null,
            (item.preferredZones || []).map((z) => z.name).join(', ') || 'Any zone',
            item.stage === 'Sent' && item.assignedAgent ? `with ${item.assignedAgent.name}` : null,
            tint || item.stage === 'New' ? null : item.stage,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <Card
              style={[
                styles.card,
                tint && { backgroundColor: tint.background, borderLeftColor: tint.edge },
              ]}
            >
              {/* The card itself is not pressable so the action buttons stay
                  separate targets for screen readers. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${name}, ${STAGE_LABELS[item.stage] || item.stage}, ${
                  item.isRead ? 'read' : 'unread'
                }`}
                onPress={() => openLead(item)}
                style={({ pressed }) => [styles.main, pressed && styles.mainPressed]}
              >
                <View style={styles.row}>
                  {item.isRead ? null : <View style={styles.unreadDot} />}
                  <Text style={[styles.cardTitle, !item.isRead && styles.unread]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.budget}>{formatBudget(item.budgetMin, item.budgetMax)}</Text>
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {meta}
                </Text>
                {item.lastFollowUp ? (
                  <Text style={styles.followUp} numberOfLines={1}>
                    ↳ {item.lastFollowUp.notes}
                  </Text>
                ) : null}
              </Pressable>
              {item.isRead ? null : (
                <CardAction
                  icon="checkmark-done-outline"
                  label={`Mark ${name} as read`}
                  onPress={() => markRead(item)}
                />
              )}
              <CardAction
                icon="chatbubble-ellipses-outline"
                label={`Add follow-up comment for ${name}`}
                onPress={() => openFollowUp(item)}
              />
            </Card>
          );
        }}
      />

      <Modal
        visible={!!followUpFor}
        transparent
        animationType="fade"
        onRequestClose={() => setFollowUpFor(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.scrim}
        >
          <Card style={styles.sheet}>
            <Text style={type.heading}>Follow-up</Text>
            <Text style={type.secondary}>{followUpFor?.customer?.name || 'Buyer'}</Text>
            <Field
              placeholder="What happened, and what is next?"
              accessibilityLabel="Follow-up comment"
              value={comment}
              onChangeText={setComment}
              multiline
              autoFocus
              containerStyle={styles.commentField}
            />
            <Button title="Save follow-up" onPress={saveFollowUp} busy={saving} />
            <Button
              variant="text"
              title="Cancel"
              onPress={() => setFollowUpFor(null)}
              disabled={saving}
            />
          </Card>
        </KeyboardAvoidingView>
      </Modal>

      {(user?.role === 'admin' ||
        user?.role === 'agent' ||
        user?.role === 'publisher' ||
        user?.role === 'owner') && (
        <Fab
          onPress={() => navigation.navigate('RequirementForm')}
          label="Add buyer requirement"
        />
      )}
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
    gap: spacing.xs,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
  },
  main: { flex: 1 },
  mainPressed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.info },
  cardTitle: { ...type.secondary, flex: 1, fontWeight: '600', color: colors.text },
  unread: { fontWeight: '800' },
  budget: { ...type.caption, color: colors.text },
  meta: { ...type.caption, fontWeight: '400', marginTop: 2 },
  followUp: { ...type.caption, fontWeight: '400', fontStyle: 'italic', marginTop: 2 },
  action: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: { backgroundColor: colors.primaryLight },
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.scrim,
  },
  sheet: { gap: spacing.sm, marginBottom: 0, ...shadow.raised },
  commentField: { marginBottom: spacing.sm },
});
