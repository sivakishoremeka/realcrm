import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import Fab from '../components/Fab';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import LoadingOverlay from '../components/LoadingOverlay';
import { colors, radius, spacing, TOUCH_TARGET, type } from '../constants/theme';

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCustomers = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await api.get('/api/customers');
      setCustomers(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCustomers();
    }, [])
  );

  const renderItem = ({ item }) => (
    <Card onPress={() => navigation.navigate('CustomerDetail', { customerId: item._id })}>
      <View style={styles.cardTop}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.phone}>{item.phone || 'No phone'}</Text>
      <Text style={styles.meta}>
        {item.email || 'No email'}
        {item.assignedAgent?.name ? ` · Agent: ${item.assignedAgent.name}` : ''}
      </Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LoadingOverlay visible={loading} />
      <ScreenHeader
        title="Buyers"
        subtitle={`${customers.length} leads · ${user?.name}`}
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

      <FlatList
        data={customers}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchCustomers(true)} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="people-outline"
              title="No buyers yet"
              hint="Tap + to add a buyer lead"
            />
          ) : null
        }
      />

      <Fab
        onPress={() => navigation.navigate('CustomerForm', { mode: 'create' })}
        label="Add buyer"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  logoutBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutPressed: {
    backgroundColor: colors.primaryLight,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 104,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...type.body,
    flex: 1,
    fontWeight: '700',
  },
  phone: {
    ...type.body,
    marginTop: spacing.sm,
  },
  meta: {
    ...type.secondary,
    marginTop: 2,
  },
});
