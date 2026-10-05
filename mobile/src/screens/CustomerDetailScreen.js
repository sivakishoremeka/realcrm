import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import ChipRow from '../components/ChipRow';
import Field from '../components/Field';
import StatusBadge from '../components/StatusBadge';
import LoadingOverlay from '../components/LoadingOverlay';
import { INTERACTION_TYPES } from '../constants/config';
// Aliased: this screen already has a `type` state variable.
import { colors, spacing, type as typography } from '../constants/theme';

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={typography.secondary}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  );
}

export default function CustomerDetailScreen({ navigation, route }) {
  const { customerId } = route.params;
  const [customer, setCustomer] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('Call');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [custRes, intRes] = await Promise.all([
        api.get(`/api/customers/${customerId}`),
        api.get(`/api/interactions/${customerId}`),
      ]);
      setCustomer(custRes.data);
      setInteractions(intRes.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [customerId])
  );

  const logInteraction = async () => {
    if (!notes.trim()) {
      Alert.alert('Validation', 'Add a short note for the interaction.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/api/interactions', {
        customer: customerId,
        type,
        notes: notes.trim(),
      });
      setInteractions((prev) => [data, ...prev]);
      setNotes('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not log interaction');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete customer', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/customers/${customerId}`);
            navigation.navigate('Dashboard');
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  if (!customer && loading) {
    return (
      <View style={styles.container}>
        <LoadingOverlay visible />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading || saving} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.titleRow}>
            <Text style={[typography.heading, styles.flex]}>{customer?.name}</Text>
            <StatusBadge status={customer?.status} />
          </View>
          <InfoRow label="Phone" value={customer?.phone || 'No phone'} />
          <InfoRow label="Email" value={customer?.email || '—'} />
          <InfoRow label="Agent" value={customer?.assignedAgent?.name || 'Unassigned'} />
          {!!customer?.notes && <InfoRow label="Notes" value={customer.notes} />}

          <View style={styles.actions}>
            <Button
              title="Edit"
              variant="secondary"
              style={styles.actionBtn}
              onPress={() =>
                navigation.navigate('CustomerForm', { mode: 'edit', customerId })
              }
            />
            <Button
              title="Delete"
              variant="danger"
              style={styles.actionBtn}
              onPress={onDelete}
            />
          </View>
        </Card>

        <Card>
          <Text style={[typography.heading, styles.sectionTitle]}>Log interaction</Text>
          <ChipRow options={INTERACTION_TYPES} value={type} onSelect={setType} />
          <Field
            accessibilityLabel="Interaction notes"
            containerStyle={styles.notesField}
            multiline
            placeholder="What happened?"
            value={notes}
            onChangeText={setNotes}
          />
          <Button title="Save activity" onPress={logInteraction} style={styles.notesField} />
        </Card>

        <Card>
          <Text style={typography.heading}>Activity history</Text>
          {interactions.length === 0 ? (
            <Text style={[typography.secondary, styles.empty]}>
              No interactions logged yet.
            </Text>
          ) : (
            interactions.map((item, index) => (
              <View key={item._id} style={[styles.activity, index > 0 && styles.divider]}>
                <View style={styles.activityTop}>
                  <Text style={[typography.body, styles.activityType]}>{item.type}</Text>
                  <Text style={typography.caption}>
                    {new Date(item.date).toLocaleString()}
                  </Text>
                </View>
                <Text style={[typography.body, styles.activityNotes]}>{item.notes}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoRow: { marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flexGrow: 1, flexBasis: 120 },
  sectionTitle: { marginBottom: spacing.md },
  notesField: { marginTop: spacing.md },
  empty: { marginTop: spacing.sm },
  activity: { paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  activityTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  activityType: { fontWeight: '600', color: colors.primary },
  activityNotes: { marginTop: spacing.xs },
});
