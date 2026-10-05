import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import api from '../api/client';
import Button from '../components/Button';
import ChipRow from '../components/ChipRow';
import Field from '../components/Field';
import { PRICE_UNITS, toRupees } from '../components/PriceField';
import LoadingOverlay from '../components/LoadingOverlay';
import ZonePicker from '../components/ZonePicker';
import { LISTING_TYPES, REQUIREMENT_PROPERTY_TYPES } from '../constants/config';
import { colors, spacing, type } from '../constants/theme';

export default function RequirementFormScreen({ navigation }) {
  const [zones, setZones] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [listingType, setListingType] = useState('Sale');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [bhkMin, setBhkMin] = useState('2');
  const [bhkMax, setBhkMax] = useState('3');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [budgetUnit, setBudgetUnit] = useState('Lakhs');
  const [selectedZones, setSelectedZones] = useState([]);
  const [notes, setNotes] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('0');
  const [leadGenSharePercent, setLeadGenSharePercent] = useState('50');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/zones');
        setZones(data);
      } catch (err) {
        Alert.alert('Error', err.response?.data?.message || 'Failed to load zones');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Buyer name is required.');
      return;
    }
    const budgets = [budgetMin, budgetMax].filter((b) => b !== '');
    if (budgets.some((b) => !(toRupees(b, budgetUnit) >= 0))) {
      Alert.alert('Validation', 'Budget must be a number, e.g. 85 or 1.25.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/api/requirements', {
        customerPayload: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
        },
        listingType,
        propertyType,
        bhkMin: bhkMin === '' ? null : Number(bhkMin),
        bhkMax: bhkMax === '' ? null : Number(bhkMax),
        budgetMin: budgetMin === '' ? 0 : toRupees(budgetMin, budgetUnit),
        budgetMax: budgetMax === '' ? null : toRupees(budgetMax, budgetUnit),
        preferredZones: selectedZones,
        notes,
        commissionPercent: commissionPercent === '' ? 0 : Number(commissionPercent),
        leadGenSharePercent:
          leadGenSharePercent === '' ? 50 : Number(leadGenSharePercent),
      });
      navigation.replace('RequirementDetail', { requirementId: data._id });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading || saving} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, styles.sectionFirst]} accessibilityRole="header">
          Buyer
        </Text>
        <Field label="Name *" value={name} onChangeText={setName} />
        <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Field
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.section} accessibilityRole="header">
          Requirement
        </Text>
        <Text style={styles.label}>Listing</Text>
        <ChipRow options={LISTING_TYPES} value={listingType} onSelect={setListingType} />
        <Text style={styles.label}>Property type</Text>
        <ChipRow
          options={REQUIREMENT_PROPERTY_TYPES}
          value={propertyType}
          onSelect={setPropertyType}
        />

        <View style={styles.row}>
          <Field
            label="BHK min"
            containerStyle={styles.half}
            keyboardType="number-pad"
            value={bhkMin}
            onChangeText={setBhkMin}
          />
          <Field
            label="BHK max"
            containerStyle={styles.half}
            keyboardType="number-pad"
            value={bhkMax}
            onChangeText={setBhkMax}
          />
        </View>

        <View style={styles.row}>
          <Field
            label="Budget min"
            containerStyle={styles.half}
            keyboardType="decimal-pad"
            value={budgetMin}
            onChangeText={setBudgetMin}
          />
          <Field
            label="Budget max"
            containerStyle={styles.half}
            keyboardType="decimal-pad"
            value={budgetMax}
            onChangeText={setBudgetMax}
          />
        </View>
        <View style={styles.units}>
          <ChipRow options={PRICE_UNITS} value={budgetUnit} onSelect={setBudgetUnit} />
        </View>

        <Text style={styles.label}>Preferred areas</Text>
        <ZonePicker
          zones={zones}
          selectedIds={selectedZones}
          onChange={setSelectedZones}
          multi
          placeholder="Select preferred areas"
        />

        <Field label="Notes" multiline value={notes} onChangeText={setNotes} />

        <Text style={styles.section} accessibilityRole="header">
          Commission split (optional)
        </Text>
        <Text style={styles.hint}>
          Total brokerage % and your share as lead generator. Serving agent gets the rest.
        </Text>
        <View style={styles.row}>
          <Field
            label="Total commission %"
            containerStyle={styles.half}
            keyboardType="decimal-pad"
            value={commissionPercent}
            onChangeText={setCommissionPercent}
          />
          <Field
            label="Lead-gen share %"
            containerStyle={styles.half}
            keyboardType="decimal-pad"
            value={leadGenSharePercent}
            onChangeText={setLeadGenSharePercent}
          />
        </View>

        <Button title="Save & find matches" onPress={onSave} style={styles.submit} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  section: { ...type.heading, marginTop: spacing.lg },
  sectionFirst: { marginTop: 0 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  hint: { ...type.secondary, marginTop: spacing.xs },
  // flex-end keeps the two inputs level when one label wraps at large font sizes
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  half: { flex: 1 },
  units: { marginTop: spacing.sm },
  submit: { marginTop: spacing.lg },
});
