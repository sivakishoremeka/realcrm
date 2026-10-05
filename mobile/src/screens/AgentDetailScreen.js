import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import Card from '../components/Card';
import RateAgentCard from '../components/RateAgentCard';
import RatedAvatar from '../components/RatedAvatar';
import { formatPrice } from '../components/PriceField';
import StatusBadge from '../components/StatusBadge';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, type } from '../constants/theme';

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={type.secondary}>{label}</Text>
      <Text style={type.body}>{value}</Text>
    </View>
  );
}

export default function AgentDetailScreen({ route }) {
  const { agentId } = route.params;
  const { user } = useAuth();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/agents/${agentId}`);
      setAgent(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load agent');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!agent && loading) {
    return (
      <View style={styles.container}>
        <LoadingOverlay visible />
      </View>
    );
  }

  const properties = agent?.properties || [];
  const reviews = agent?.reviews || [];

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.heroRow}>
            <RatedAvatar
              uri={agent?.user?.profilePic}
              name={agent?.user?.name}
              ratingAvg={agent?.ratingAvg}
              ratingCount={agent?.ratingCount}
              size={72}
            />
            <View style={styles.heroText}>
              <Text style={type.heading}>{agent?.user?.name}</Text>
              <Text style={[type.secondary, styles.email]}>{agent?.user?.email}</Text>
            </View>
          </View>
          <InfoRow label="Agency" value={agent?.agencyName || 'Independent'} />
          <InfoRow label="Phone" value={agent?.phone || '—'} />
          <InfoRow label="Experience" value={`${agent?.yearsExperience ?? 0} yrs`} />
          <InfoRow
            label="Zones"
            value={(agent?.zones || []).map((z) => z.name).join(', ') || 'None'}
          />
          {!!agent?.bio && <InfoRow label="About" value={agent.bio} />}
        </Card>

        {isAdmin && (
          <RateAgentCard
            agentId={agentId}
            agentName={agent?.user?.name}
            profilePic={agent?.user?.profilePic}
            ratingAvg={agent?.ratingAvg}
            ratingCount={agent?.ratingCount}
            title="Business Owner rating"
            hint="Rate this publisher for the community directory."
            onSubmitted={(data) =>
              setAgent((prev) => ({
                ...prev,
                ratingAvg: data.ratingAvg,
                ratingCount: data.ratingCount,
              }))
            }
          />
        )}

        {reviews.length > 0 && (
          <Card>
            <Text style={type.heading}>Recent reviews</Text>
            {reviews.map((r, index) => (
              <View key={r._id} style={[styles.listRow, index > 0 && styles.divider]}>
                <Text style={[type.body, styles.semibold]}>
                  ★ {r.rating} · {r.author?.name || 'Reviewer'}
                </Text>
                {!!r.comment && (
                  <Text style={[type.secondary, styles.rowLine]}>{r.comment}</Text>
                )}
              </View>
            ))}
          </Card>
        )}

        <Card>
          <Text style={type.heading}>Inventory ({properties.length})</Text>
          {properties.length === 0 && (
            <Text style={[type.secondary, styles.empty]}>No listings yet.</Text>
          )}
          {properties.map((p, index) => (
            <View key={p._id} style={[styles.listRow, index > 0 && styles.divider]}>
              <View style={styles.titleRow}>
                <Text style={[type.body, styles.listTitle]}>{p.title}</Text>
                <StatusBadge status={p.status} />
              </View>
              <Text style={[type.secondary, styles.rowLine]}>
                {p.type} · {p.listingType} · {p.zone?.name}
              </Text>
              <Text style={[type.body, styles.price]}>{formatPrice(p.price)}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroText: { flex: 1 },
  email: { marginTop: 2 },
  infoRow: { marginTop: spacing.sm },
  empty: { marginTop: spacing.sm },
  listRow: { paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listTitle: { flex: 1, fontWeight: '600' },
  rowLine: { marginTop: spacing.xs },
  price: { marginTop: spacing.xs, fontWeight: '700' },
  semibold: { fontWeight: '600' },
});
