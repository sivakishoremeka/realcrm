import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import RateAgentCard from '../components/RateAgentCard';
import RatedAvatar from '../components/RatedAvatar';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import LoadingOverlay from '../components/LoadingOverlay';
import { colors, spacing, type } from '../constants/theme';

export default function CustomerEnquiriesScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingEnquiryId, setRatingEnquiryId] = useState(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await api.get('/api/marketplace/enquiries/mine');
      setItems(data || []);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not load enquiries');
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LoadingOverlay visible={loading} />
      <ScreenHeader title="My enquiries" />
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
              icon="chatbubbles-outline"
              title="No enquiries yet"
              hint="Browse homes and send an enquiry"
            />
          ) : null
        }
        renderItem={({ item }) => {
          const publisher = item.property?.publisher;
          const expanded = ratingEnquiryId === item._id;
          return (
            <View style={styles.block}>
              <Card
                onPress={() =>
                  item.property?._id &&
                  navigation.navigate('CustomerListingDetail', {
                    listingId: item.property._id,
                  })
                }
              >
                <View style={styles.row}>
                  {!!publisher && (
                    <RatedAvatar
                      uri={publisher.profilePic}
                      name={publisher.name}
                      ratingAvg={publisher.ratingAvg}
                      ratingCount={publisher.ratingCount}
                      size={48}
                      showLabel={false}
                    />
                  )}
                  <View style={styles.metaCol}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.property?.title || 'Property'}
                      </Text>
                      <StatusBadge status={item.status} />
                    </View>
                    <Text style={styles.meta}>
                      {item.property?.zone?.name || '—'} ·{' '}
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                    </Text>
                    {!!publisher && (
                      <Text style={styles.publisher}>
                        {publisher.name}
                        {publisher.ratingCount
                          ? ` · ★ ${Number(publisher.ratingAvg).toFixed(1)}`
                          : ''}
                      </Text>
                    )}
                    {!!item.message && (
                      <Text style={styles.message} numberOfLines={3}>
                        {item.message}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
              {!!publisher?.id && (
                <Text
                  style={styles.rateLink}
                  onPress={() => setRatingEnquiryId(expanded ? null : item._id)}
                  accessibilityRole="button"
                >
                  {expanded ? 'Hide rating' : 'Rate this publisher'}
                </Text>
              )}
              {expanded && publisher?.id && (
                <RateAgentCard
                  agentId={publisher.id}
                  agentName={publisher.name}
                  profilePic={publisher.profilePic}
                  ratingAvg={publisher.ratingAvg}
                  ratingCount={publisher.ratingCount}
                  enquiryId={item._id}
                  title="Rate publisher"
                  hint="Share how this publisher handled your enquiry."
                  onSubmitted={() => {
                    setRatingEnquiryId(null);
                    load(true);
                  }}
                />
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  block: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  metaCol: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { ...type.body, flex: 1, fontWeight: '700' },
  meta: { ...type.secondary, marginTop: spacing.sm },
  publisher: { ...type.secondary, marginTop: spacing.xs, color: colors.text, fontWeight: '600' },
  message: { ...type.secondary, marginTop: spacing.sm, color: colors.text },
  rateLink: {
    ...type.body,
    color: colors.primary,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
});
