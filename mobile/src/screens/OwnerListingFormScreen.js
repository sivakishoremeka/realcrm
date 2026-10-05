import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../api/client';
import Button from '../components/Button';
import ChipRow from '../components/ChipRow';
import PriceField, { splitRupees, toRupees } from '../components/PriceField';
import Field from '../components/Field';
import LoadingOverlay from '../components/LoadingOverlay';
import ZonePicker from '../components/ZonePicker';
import { LISTING_TYPES, PROPERTY_TYPES } from '../constants/config';
// `type` is a state variable in this screen, so the theme text styles are aliased
import {
  colors,
  radius,
  spacing,
  TOUCH_TARGET,
  type as textStyles,
} from '../constants/theme';

export default function OwnerListingFormScreen({ navigation, route }) {
  const { mode = 'create', listingId: initialId } = route.params || {};
  const [listingId, setListingId] = useState(initialId || null);
  const [zones, setZones] = useState([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Apartment');
  const [listingType, setListingType] = useState('Sale');
  const [bhk, setBhk] = useState('');
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('Lakhs');
  const [areaSqft, setAreaSqft] = useState('');
  const [zoneId, setZoneId] = useState(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [listedViaAgent, setListedViaAgent] = useState(false);
  const [viaAgentNote, setViaAgentNote] = useState('');
  const [termsText, setTermsText] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState('Draft');
  const [loading, setLoading] = useState(true);

  const hydrate = (data) => {
    setListingId(data._id);
    setTitle(data.title || '');
    setType(data.type || 'Apartment');
    setListingType(data.listingType || 'Sale');
    setBhk(data.bhk != null ? String(data.bhk) : '');
    const savedPrice = splitRupees(data.price);
    setPrice(savedPrice.amount);
    setPriceUnit(savedPrice.unit);
    setAreaSqft(data.areaSqft != null ? String(data.areaSqft) : '');
    setZoneId(data.zone?._id || data.zone);
    setAddress(data.address || '');
    setNotes(data.notes || '');
    setListedViaAgent(!!data.listedViaAgent);
    setViaAgentNote(data.viaAgentNote || '');
    setTermsText(data.termsText || '');
    setImages(data.images || []);
    setStatus(data.status || 'Draft');
    setTermsAccepted(!!data.termsAcceptedAt);
  };

  useEffect(() => {
    (async () => {
      try {
        const [zonesRes, templateRes] = await Promise.all([
          api.get('/api/zones'),
          api.get('/api/listings/terms-template', { params: { listingType: 'Sale' } }),
        ]);
        setZones(zonesRes.data);
        if (mode === 'edit' && initialId) {
          const { data } = await api.get(`/api/listings/${initialId}`);
          hydrate(data);
        } else {
          setTermsText(templateRes.data.text || '');
        }
      } catch (err) {
        Alert.alert('Error', err.response?.data?.message || 'Failed to load');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, initialId, navigation]);

  const refreshTermsForType = async (nextType) => {
    setListingType(nextType);
    if (listingId) return;
    try {
      const { data } = await api.get('/api/listings/terms-template', {
        params: { listingType: nextType },
      });
      setTermsText(data.text || '');
    } catch {
      // keep current terms
    }
  };

  const buildPayload = () => ({
    title: title.trim(),
    type,
    listingType,
    bhk: bhk === '' ? null : Number(bhk),
    price: toRupees(price, priceUnit),
    areaSqft: areaSqft === '' ? null : Number(areaSqft),
    zone: zoneId,
    address,
    notes,
    listedViaAgent,
    viaAgentNote,
    termsText,
  });

  const ensureSaved = async () => {
    if (!title.trim() || !(toRupees(price, priceUnit) > 0) || !zoneId) {
      Alert.alert('Validation', 'Title, price, and zone are required.');
      return null;
    }
    const payload = buildPayload();
    if (listingId) {
      const { data } = await api.put(`/api/listings/${listingId}`, payload);
      hydrate(data);
      return data;
    }
    const { data } = await api.post('/api/listings', payload);
    hydrate(data);
    navigation.setOptions({ title: 'Edit listing' });
    return data;
  };

  const onSaveDraft = async () => {
    setLoading(true);
    try {
      await ensureSaved();
      Alert.alert('Saved', 'Draft listing saved.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const onPublish = async () => {
    if (!termsAccepted) {
      Alert.alert('Accept T&Cs', 'Check “I accept the Terms & Conditions” to publish.');
      return;
    }
    setLoading(true);
    try {
      const saved = await ensureSaved();
      if (!saved) {
        setLoading(false);
        return;
      }
      if (!(saved.images || []).length) {
        Alert.alert('Photos required', 'Add at least one photo before publishing.');
        setLoading(false);
        return;
      }
      const { data } = await api.post(`/api/listings/${saved._id}/publish`, {
        accepted: true,
      });
      hydrate(data);
      Alert.alert('Published', 'Listing is now Available.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Publish failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const pickAndUploadImages = async () => {
    setLoading(true);
    try {
      const saved = await ensureSaved();
      if (!saved) {
        setLoading(false);
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to upload images.');
        setLoading(false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 8,
      });
      if (result.canceled || !result.assets?.length) {
        setLoading(false);
        return;
      }

      const form = new FormData();
      result.assets.forEach((asset, idx) => {
        form.append('images', {
          uri: asset.uri,
          name: asset.fileName || `photo-${Date.now()}-${idx}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });
      });

      const { data } = await api.post(`/api/listings/${saved._id}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      hydrate(data);
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = async (url) => {
    if (!listingId) return;
    setLoading(true);
    try {
      const { data } = await api.delete(`/api/listings/${listingId}/images`, {
        data: { url },
      });
      hydrate(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not remove image');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = () => {
    if (!listingId) {
      navigation.goBack();
      return;
    }
    Alert.alert('Delete listing?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await api.delete(`/api/listings/${listingId}`);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Delete failed');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>Status: {status}</Text>

        <Text style={styles.section} accessibilityRole="header">
          Property details
        </Text>
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="3BHK in Gachibowli"
        />

        <Text style={styles.label}>Property type</Text>
        <ChipRow options={PROPERTY_TYPES} value={type} onSelect={setType} />

        <Text style={styles.label}>Listing type</Text>
        <ChipRow options={LISTING_TYPES} value={listingType} onSelect={refreshTermsForType} />

        <Field
          label="BHK"
          value={bhk}
          onChangeText={setBhk}
          keyboardType="numeric"
          placeholder="3"
        />
        <PriceField
          label="Price (₹)"
          amount={price}
          unit={priceUnit}
          onChangeAmount={setPrice}
          onChangeUnit={setPriceUnit}
        />
        <Field
          label="Area (sqft)"
          value={areaSqft}
          onChangeText={setAreaSqft}
          keyboardType="numeric"
          placeholder="1450"
        />

        <Text style={styles.section} accessibilityRole="header">
          Location
        </Text>
        <Text style={styles.label}>Area</Text>
        <ZonePicker
          zones={zones}
          selectedIds={zoneId ? [zoneId] : []}
          onChange={(ids) => setZoneId(ids[0] || null)}
          multi={false}
          placeholder="Select area"
        />
        <Field
          label="Address"
          value={address}
          onChangeText={setAddress}
          multiline
          placeholder="Flat / street / landmark"
        />

        <Text style={styles.section} accessibilityRole="header">
          More details
        </Text>
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Facing, floor, amenities…"
        />

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Listed via agent</Text>
            <Text style={textStyles.secondary}>Informational only — no agent claim yet</Text>
          </View>
          <Switch
            accessibilityLabel="Listed via agent"
            value={listedViaAgent}
            onValueChange={setListedViaAgent}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        {listedViaAgent ? (
          <Field
            label="Via-agent note"
            value={viaAgentNote}
            onChangeText={setViaAgentNote}
            placeholder="e.g. Working with ABC Realty"
          />
        ) : null}

        <Text style={styles.section} accessibilityRole="header">
          Photos
        </Text>
        <View style={styles.imageGrid}>
          {images.map((url) => (
            <View key={url} style={styles.imageWrap}>
              <Image source={{ uri: url }} style={styles.thumb} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                hitSlop={10}
                style={({ pressed }) => [styles.removeImg, pressed && styles.pressed]}
                onPress={() => removeImage(url)}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.addImg, pressed && styles.pressed]}
            onPress={pickAndUploadImages}
          >
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
            <Text style={styles.addImgText}>+ Add</Text>
          </Pressable>
        </View>

        <Text style={styles.section} accessibilityRole="header">
          Terms & Conditions
        </Text>
        <Field
          accessibilityLabel="Terms & Conditions"
          containerStyle={styles.termsWrap}
          style={styles.terms}
          value={termsText}
          onChangeText={setTermsText}
          multiline
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          style={({ pressed }) => [styles.acceptRow, pressed && styles.pressed]}
          onPress={() => setTermsAccepted((v) => !v)}
        >
          <Ionicons
            name={termsAccepted ? 'checkbox' : 'square-outline'}
            size={24}
            color={colors.primary}
          />
          <Text style={styles.acceptText}>I accept these Terms & Conditions</Text>
        </Pressable>

        <Button title="Publish" onPress={onPublish} style={styles.submit} />
        <Button
          variant="secondary"
          title="Save draft"
          onPress={onSaveDraft}
          style={styles.action}
        />
        <Button
          variant={listingId ? 'danger' : 'text'}
          title={listingId ? 'Delete listing' : 'Cancel'}
          onPress={onDelete}
          style={styles.action}
        />
      </ScrollView>
    </View>
  );
}

const THUMB_SIZE = 88;
const REMOVE_SIZE = 28;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  hint: { ...textStyles.secondary, fontWeight: '600' },
  section: { ...textStyles.heading, marginTop: spacing.lg },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  switchText: { flex: 1 },
  switchLabel: { ...textStyles.body, fontWeight: '600' },
  termsWrap: { marginTop: spacing.md },
  terms: { minHeight: 180 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  imageWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  removeImg: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    borderRadius: REMOVE_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImg: {
    minWidth: THUMB_SIZE,
    minHeight: THUMB_SIZE,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addImgText: { fontSize: 14, fontWeight: '600', color: colors.primary, marginTop: 2 },
  pressed: { opacity: 0.8 },
  acceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  acceptText: { ...textStyles.body, flex: 1 },
  submit: { marginTop: spacing.lg },
  action: { marginTop: spacing.sm },
});
