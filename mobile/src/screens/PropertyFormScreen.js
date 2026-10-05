import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
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
import {
  FACING_OPTIONS,
  LISTING_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  RESIDENCE_STYLES,
  VILLA_TYPES,
} from '../constants/config';
// `type` is a state variable in this screen, so the theme text styles are aliased
import { colors, radius, spacing, type as textStyles } from '../constants/theme';
import { sharePropertyOnWhatsApp } from '../utils/whatsappShare';
import { useAuth } from '../context/AuthContext';

export default function PropertyFormScreen({ navigation, route }) {
  const { mode = 'create', propertyId: initialId } = route.params || {};
  const { user } = useAuth();
  const [propertyId, setPropertyId] = useState(initialId || null);
  const [zones, setZones] = useState([]);
  const [property, setProperty] = useState(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Apartment');
  const [listingType, setListingType] = useState('Sale');
  const [residenceStyle, setResidenceStyle] = useState('');
  const [facing, setFacing] = useState('');
  const [carpetArea, setCarpetArea] = useState('');
  const [bhk, setBhk] = useState('');
  const [villaType, setVillaType] = useState('');
  const [plotSize, setPlotSize] = useState('');
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('Lakhs');
  const [areaSqft, setAreaSqft] = useState('');
  const [zoneId, setZoneId] = useState(null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('Available');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState([]);
  const [caption, setCaption] = useState('');
  const [script, setScript] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [loading, setLoading] = useState(true);

  const hydrate = (data) => {
    setProperty(data);
    setPropertyId(data._id);
    setTitle(data.title || '');
    setType(data.type || 'Apartment');
    setListingType(data.listingType || 'Sale');
    setResidenceStyle(data.residenceStyle || '');
    setFacing(data.facing || '');
    setCarpetArea(data.carpetArea != null ? String(data.carpetArea) : '');
    setBhk(data.bhk != null ? String(data.bhk) : '');
    setVillaType(data.villaType || '');
    setPlotSize(data.plotSize || '');
    const savedPrice = splitRupees(data.price);
    setPrice(savedPrice.amount);
    setPriceUnit(savedPrice.unit);
    setAreaSqft(data.areaSqft != null ? String(data.areaSqft) : '');
    setZoneId(data.zone?._id || data.zone);
    setAddress(data.address || '');
    setStatus(data.status || 'Available');
    setNotes(data.notes || '');
    setImages(data.images || []);
    setCaption(data.generatedCaption || '');
    setScript(data.generatedScript || '');
  };

  useEffect(() => {
    (async () => {
      try {
        const [zonesRes, meRes] = await Promise.all([
          api.get('/api/zones'),
          api.get('/api/agents/me').catch(() => ({ data: {} })),
        ]);
        setZones(zonesRes.data);
        setAgentPhone(meRes.data.phone || '');
        if (mode === 'edit' && initialId) {
          const { data } = await api.get(`/api/properties/${initialId}`);
          hydrate(data);
        }
      } catch (err) {
        Alert.alert('Error', err.response?.data?.message || 'Failed to load');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, initialId, navigation]);

  const buildPayload = () => ({
    title: title.trim(),
    type,
    listingType,
    residenceStyle: type === 'Apartment' || type === 'Villa' ? residenceStyle : '',
    facing: type === 'Apartment' || type === 'Plot' ? facing : '',
    carpetArea:
      type === 'Apartment' && carpetArea !== '' ? Number(carpetArea) : null,
    bhk: type === 'Apartment' && bhk !== '' ? Number(bhk) : null,
    villaType: type === 'Villa' ? villaType : '',
    plotSize: type === 'Plot' ? plotSize.trim() : '',
    price: toRupees(price, priceUnit),
    areaSqft:
      (type === 'Commercial' || type === 'Plot' || type === 'Villa') && areaSqft !== ''
        ? Number(areaSqft)
        : type === 'Apartment'
          ? carpetArea !== ''
            ? Number(carpetArea)
            : null
          : areaSqft === ''
            ? null
            : Number(areaSqft),
    zone: zoneId,
    address,
    status,
    notes,
  });

  const onSave = async () => {
    if (!title.trim() || !(toRupees(price, priceUnit) > 0) || !zoneId) {
      Alert.alert('Validation', 'Title, price, and area (zone) are required.');
      return;
    }
    setLoading(true);
    const payload = buildPayload();
    try {
      if (propertyId) {
        const { data } = await api.put(`/api/properties/${propertyId}`, payload);
        hydrate(data);
        Alert.alert('Saved', 'Property updated');
      } else {
        const { data } = await api.post('/api/properties', payload);
        hydrate(data);
        navigation.setOptions({ title: 'Edit property' });
        navigation.replace('PropertyForm', { mode: 'edit', propertyId: data._id });
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const pickAndUploadImages = async () => {
    if (!propertyId) {
      Alert.alert('Save first', 'Save the property before uploading photos.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 8,
    });
    if (result.canceled || !result.assets?.length) return;

    const form = new FormData();
    result.assets.forEach((asset, idx) => {
      form.append('images', {
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}-${idx}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    });

    setLoading(true);
    try {
      const { data } = await api.post(`/api/properties/${propertyId}/images`, form, {
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
    if (!propertyId) return;
    setLoading(true);
    try {
      const { data } = await api.delete(`/api/properties/${propertyId}/images`, {
        data: { url },
      });
      hydrate(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not remove image');
    } finally {
      setLoading(false);
    }
  };

  const pickAndUploadVideo = async () => {
    if (!propertyId) {
      Alert.alert('Save first', 'Save the property before uploading a reel clip.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow media access to pick a video clip.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const form = new FormData();
    form.append('video', {
      uri: asset.uri,
      name: asset.fileName || `reel-${Date.now()}.mp4`,
      type: asset.mimeType || 'video/mp4',
    });

    setLoading(true);
    try {
      const { data } = await api.post(`/api/properties/${propertyId}/video`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      hydrate(data);
      Alert.alert('Uploaded', 'Video clip attached.');
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateCaption = async () => {
    if (!propertyId) {
      Alert.alert('Save first', 'Save the property before generating a caption.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(`/api/properties/${propertyId}/generate-caption`);
      setCaption(data.caption || '');
      setScript(data.script || '');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Caption failed');
    } finally {
      setLoading(false);
    }
  };

  const publishReel = async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/api/properties/${propertyId}/publish-reel`, {
        caption,
      });
      hydrate(data.property || data);
      Alert.alert('Published', 'Reel sent to Instagram.');
    } catch (err) {
      Alert.alert('Publish failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const onWhatsApp = async () => {
    const snapshot = {
      ...property,
      title,
      type,
      listingType,
      bhk: bhk === '' ? null : Number(bhk),
      price: price === '' ? null : toRupees(price, priceUnit),
      address,
      notes,
      zone: zones.find((z) => z._id === zoneId) || property?.zone,
      images,
    };
    await sharePropertyOnWhatsApp(snapshot, agentPhone);
  };

  const onDelete = () => {
    if (!propertyId) {
      navigation.goBack();
      return;
    }
    Alert.alert('Delete property', 'Remove this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/properties/${propertyId}`);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  // Tapping the selected chip again clears it
  const toggleOf = (current, setValue) => (opt) => setValue(current === opt ? '' : opt);

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, styles.sectionFirst]} accessibilityRole="header">
          Basics
        </Text>
        <Field label="Title *" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Property type</Text>
        <ChipRow
          options={PROPERTY_TYPES}
          value={type}
          onSelect={setType}
          labels={PROPERTY_TYPE_LABELS}
        />

        <Text style={styles.label}>Listing</Text>
        <ChipRow options={LISTING_TYPES} value={listingType} onSelect={setListingType} />

        {(type === 'Apartment' || type === 'Villa') && (
          <>
            <Text style={styles.label}>Gated / Independent</Text>
            <ChipRow
              options={RESIDENCE_STYLES}
              value={residenceStyle}
              onSelect={toggleOf(residenceStyle, setResidenceStyle)}
            />
          </>
        )}

        {type === 'Apartment' && (
          <>
            <Text style={styles.section} accessibilityRole="header">
              Flat details
            </Text>
            <Text style={styles.label}>Facing</Text>
            <ChipRow
              options={FACING_OPTIONS}
              value={facing}
              onSelect={toggleOf(facing, setFacing)}
            />
            <Field
              label="Carpet area (sqft)"
              keyboardType="number-pad"
              value={carpetArea}
              onChangeText={setCarpetArea}
              placeholder="e.g. 1250"
            />
            <Field
              label="BHK"
              keyboardType="number-pad"
              value={bhk}
              onChangeText={setBhk}
              placeholder="e.g. 3"
            />
          </>
        )}

        {type === 'Commercial' && (
          <>
            <Text style={styles.section} accessibilityRole="header">
              Commercial details
            </Text>
            <Field
              label="Area (sqft)"
              keyboardType="number-pad"
              value={areaSqft}
              onChangeText={setAreaSqft}
              placeholder="e.g. 2400"
            />
          </>
        )}

        {type === 'Villa' && (
          <>
            <Text style={styles.section} accessibilityRole="header">
              Villa details
            </Text>
            <Text style={styles.label}>Villa type</Text>
            <ChipRow
              options={VILLA_TYPES}
              value={villaType}
              onSelect={toggleOf(villaType, setVillaType)}
            />
            <Field
              label="Built-up area (sqft)"
              keyboardType="number-pad"
              value={areaSqft}
              onChangeText={setAreaSqft}
              placeholder="e.g. 3200"
            />
          </>
        )}

        {type === 'Plot' && (
          <>
            <Text style={styles.section} accessibilityRole="header">
              Plot details
            </Text>
            <Text style={styles.label}>Facing</Text>
            <ChipRow
              options={FACING_OPTIONS}
              value={facing}
              onSelect={toggleOf(facing, setFacing)}
            />
            <Field
              label="Size"
              value={plotSize}
              onChangeText={setPlotSize}
              placeholder="e.g. 200 sq yards"
            />
            <Field
              label="Area (sqft)"
              keyboardType="number-pad"
              value={areaSqft}
              onChangeText={setAreaSqft}
              placeholder="e.g. 1800"
            />
          </>
        )}

        <Text style={styles.section} accessibilityRole="header">
          Price & location
        </Text>
        <PriceField
          label="Price (₹) *"
          amount={price}
          unit={priceUnit}
          onChangeAmount={setPrice}
          onChangeUnit={setPriceUnit}
        />

        <Text style={styles.label}>Zone / Area *</Text>
        <ZonePicker
          zones={zones}
          selectedIds={zoneId ? [zoneId] : []}
          onChange={(ids) => setZoneId(ids[0] || null)}
          multi={false}
          placeholder="Select area"
        />

        <Field label="Address" value={address} onChangeText={setAddress} />

        <Text style={styles.label}>Status</Text>
        <ChipRow options={PROPERTY_STATUSES} value={status} onSelect={setStatus} />

        <Field label="Notes" multiline value={notes} onChangeText={setNotes} />

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
        {!propertyId ? (
          <Text style={styles.hint}>Save the property first, then add photos.</Text>
        ) : null}

        <Button
          title={`${propertyId ? 'Update' : 'Add'} property`}
          onPress={onSave}
          style={styles.submit}
        />

        {propertyId && (
          <>
            <Text style={styles.section} accessibilityRole="header">
              Share & publish
            </Text>
            <Button
              variant="secondary"
              title="Share on WhatsApp"
              onPress={onWhatsApp}
              style={styles.action}
            />
            <Button
              variant="secondary"
              title={property?.videoUrl ? 'Replace reel video clip' : 'Upload reel video clip'}
              onPress={pickAndUploadVideo}
              style={styles.action}
            />
            {!!property?.videoUrl && (
              <Text style={styles.hint} numberOfLines={2}>
                Video: {property.videoUrl}
              </Text>
            )}
            <Button
              variant="secondary"
              title="Generate caption (your OpenAI key)"
              onPress={generateCaption}
              style={styles.action}
            />

            <Field label="Instagram caption" multiline value={caption} onChangeText={setCaption} />
            {!!script && (
              <>
                <Text style={styles.label}>Spoken script</Text>
                <Text style={styles.script}>{script}</Text>
              </>
            )}

            <Button
              variant="secondary"
              title="Publish Reel to Instagram"
              onPress={publishReel}
              style={styles.submit}
            />
            <Button variant="danger" title="Delete" onPress={onDelete} style={styles.action} />
            <Text style={styles.footerHint}>
              Agent: {user?.name}. Connect Instagram under Profile before publishing.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const THUMB_SIZE = 88;
const REMOVE_SIZE = 28;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  section: { ...textStyles.heading, marginTop: spacing.lg },
  sectionFirst: { marginTop: 0 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  script: {
    ...textStyles.secondary,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.control,
  },
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
  submit: { marginTop: spacing.lg },
  action: { marginTop: spacing.sm },
  hint: { ...textStyles.secondary, marginTop: 6 },
  footerHint: { ...textStyles.secondary, marginTop: spacing.md },
});
