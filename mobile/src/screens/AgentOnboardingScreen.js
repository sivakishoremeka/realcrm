import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import LoadingOverlay from '../components/LoadingOverlay';
import ZonePicker from '../components/ZonePicker';
import ZoneMapPreview from '../components/ZoneMapPreview';
import Button from '../components/Button';
import Field from '../components/Field';
import { colors, spacing, type } from '../constants/theme';

export default function AgentOnboardingScreen() {
  const { updateUser, logout } = useAuth();
  const [phone, setPhone] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('0');
  const [zones, setZones] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [zonesRes, meRes] = await Promise.all([
          api.get('/api/zones'),
          api.get('/api/agents/me'),
        ]);
        setZones(zonesRes.data);
        setPhone(meRes.data.phone || '');
        setAgencyName(meRes.data.agencyName || '');
        setBio(meRes.data.bio || '');
        setYearsExperience(String(meRes.data.yearsExperience ?? 0));
        setSelectedZones((meRes.data.zones || []).map((z) => z._id));
      } catch (err) {
        Alert.alert('Error', err.response?.data?.message || 'Failed to load onboarding');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onComplete = async () => {
    if (!phone.trim()) {
      Alert.alert('Required', 'Phone number is required.');
      return;
    }
    if (!selectedZones.length) {
      Alert.alert('Required', 'Select at least one area you serve.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/api/agents/me', {
        phone: phone.trim(),
        agencyName: agencyName.trim(),
        bio,
        yearsExperience: Number(yearsExperience) || 0,
        zoneIds: selectedZones,
        complete: true,
      });
      await updateUser({ onboardingComplete: !!data.onboardingComplete });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LoadingOverlay visible={loading || saving} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.title} accessibilityRole="header">
          Agent onboarding
        </Text>
        <Text style={styles.subtitle}>
          Tell us about your dealership and the Hyderabad areas you serve.
        </Text>

        <Field
          label="Phone *"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          placeholder="+91 ..."
        />

        <Field
          label="Agency / Dealership"
          value={agencyName}
          onChangeText={setAgencyName}
          placeholder="e.g. Westside Homes"
        />

        <Field
          label="Years of experience"
          keyboardType="number-pad"
          value={yearsExperience}
          onChangeText={setYearsExperience}
        />

        <Field
          label="Bio"
          multiline
          value={bio}
          onChangeText={setBio}
          placeholder="Specialties, languages, focus areas..."
        />

        <Text style={styles.label}>Areas served *</Text>
        <Text style={styles.hint}>Open the dropdown and pick one or more areas</Text>
        <ZonePicker
          zones={zones}
          selectedIds={selectedZones}
          onChange={setSelectedZones}
          multi
          placeholder="Select areas served"
        />
        <ZoneMapPreview zones={zones} selectedIds={selectedZones} height={200} />

        <Button title="Complete onboarding" onPress={onComplete} style={styles.submit} />
        <Button title="Logout" onPress={logout} variant="text" style={styles.logout} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl + spacing.md },
  subtitle: { ...type.secondary, marginTop: spacing.xs, marginBottom: spacing.sm },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  hint: { ...type.caption, fontWeight: '400', marginTop: 2, marginBottom: spacing.sm },
  submit: { marginTop: spacing.lg },
  logout: { marginTop: spacing.sm },
});
