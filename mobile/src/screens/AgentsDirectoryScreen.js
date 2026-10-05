import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import RatedAvatar from '../components/RatedAvatar';
import ScreenHeader from '../components/ScreenHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import { colors, spacing, type } from '../constants/theme';

export default function AgentsDirectoryScreen({ navigation }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await api.get('/api/agents');
      setAgents(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not load agents');
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
      <ScreenHeader
        title="Agents & dealers"
        subtitle={`${agents.length} onboarded profiles`}
      />

      <FlatList
        data={agents}
        keyExtractor={(item) => item._id || item.user?._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="people-outline"
              title="No agents yet"
              hint="Agents appear after they register and onboard"
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              navigation.navigate('AgentDetail', { agentId: item.user?._id || item.user })
            }
          >
            <View style={styles.row}>
              <RatedAvatar
                uri={item.user?.profilePic}
                name={item.user?.name}
                ratingAvg={item.ratingAvg}
                ratingCount={item.ratingCount}
                size={56}
              />
              <View style={styles.metaCol}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.user?.name || 'Agent'}
                </Text>
                <Text style={styles.agency}>{item.agencyName || 'Independent dealer'}</Text>
                <Text style={styles.zones}>
                  {(item.zones || []).map((z) => z.name).join(', ') || 'No zones set'}
                </Text>
                <Text style={styles.meta}>
                  {item.availableCount ?? 0} available · {item.inventoryCount ?? 0} total
                  {item.onboardingComplete ? '' : ' · Incomplete onboarding'}
                </Text>
                {!!item.phone && <Text style={styles.phone}>{item.phone}</Text>}
              </View>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  metaCol: { flex: 1 },
  name: { ...type.body, fontWeight: '700' },
  agency: { ...type.secondary, marginTop: spacing.xs, color: colors.text },
  zones: { ...type.secondary, marginTop: spacing.xs },
  meta: { ...type.secondary, marginTop: spacing.sm },
  phone: { ...type.body, marginTop: spacing.xs, fontWeight: '600' },
});
