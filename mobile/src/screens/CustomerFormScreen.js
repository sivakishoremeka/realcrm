import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import api from '../api/client';
import Button from '../components/Button';
import ChipRow from '../components/ChipRow';
import Field from '../components/Field';
import LoadingOverlay from '../components/LoadingOverlay';
import { CUSTOMER_STATUSES } from '../constants/config';
import { colors, spacing, type } from '../constants/theme';

export default function CustomerFormScreen({ navigation, route }) {
  const { mode = 'create', customerId } = route.params || {};
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('Lead');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');

  useEffect(() => {
    if (mode !== 'edit' || !customerId) return;
    (async () => {
      try {
        const { data } = await api.get(`/api/customers/${customerId}`);
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setStatus(data.status || 'Lead');
        setNotes(data.notes || '');
      } catch (err) {
        Alert.alert('Error', err.response?.data?.message || 'Failed to load customer');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, customerId, navigation]);

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    setLoading(true);
    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      status,
      notes,
    };
    try {
      if (mode === 'edit') {
        await api.put(`/api/customers/${customerId}`, payload);
      } else {
        await api.post('/api/customers', payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section} accessibilityRole="header">
          Buyer details
        </Text>
        <Field label="Name *" value={name} onChangeText={setName} />
        <Field
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

        <Text style={styles.label}>Status</Text>
        <ChipRow options={CUSTOMER_STATUSES} value={status} onSelect={setStatus} />

        <Field label="Notes" multiline value={notes} onChangeText={setNotes} />

        <Button
          title={`${mode === 'edit' ? 'Update' : 'Create'} Buyer`}
          onPress={onSave}
          style={styles.submit}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  section: type.heading,
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  submit: { marginTop: spacing.lg },
});
