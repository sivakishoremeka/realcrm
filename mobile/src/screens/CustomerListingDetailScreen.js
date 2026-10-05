import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Button from '../components/Button';
import { formatPrice } from '../components/PriceField';
import Card from '../components/Card';
import Field from '../components/Field';
import LoadingOverlay from '../components/LoadingOverlay';
import RatedAvatar from '../components/RatedAvatar';
import { PROPERTY_TYPE_LABELS } from '../constants/config';
import { colors, radius, spacing, type } from '../constants/theme';

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={type.secondary}>{label}</Text>
      <Text style={type.body}>{value}</Text>
    </View>
  );
}

export default function CustomerListingDetailScreen({ route, navigation }) {
  const { listingId } = route.params;
  const [listing, setListing] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/marketplace/listings/${listingId}`);
        setListing(data);
      } catch (err) {
        Alert.alert('Error', err.response?.data?.message || 'Failed to load');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId, navigation]);

  const enquire = async () => {
    setSending(true);
    try {
      await api.post('/api/marketplace/enquiries', {
        property: listingId,
        message: message.trim() || 'I am interested in this property.',
      });
      Alert.alert('Enquiry sent', 'A publisher will follow up with you soon.', [
        {
          text: 'OK',
          onPress: () =>
            navigation.navigate('CustomerHome', { screen: 'CustomerEnquiriesTab' }),
        },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not send enquiry');
    } finally {
      setSending(false);
    }
  };

  if (!listing && loading) {
    return (
      <View style={styles.container}>
        <LoadingOverlay visible />
      </View>
    );
  }

  const images = listing?.images || [];
  const publisher = listing?.publisher;

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading || sending} />
      <ScrollView contentContainerStyle={styles.content}>
        {images[0] ? (
          <Image
            source={{ uri: images[0] }}
            style={styles.hero}
            accessibilityLabel="Property photo"
          />
        ) : (
          <View style={[styles.hero, styles.heroPh]}>
            <Ionicons name="image-outline" size={32} color={colors.textMuted} />
            <Text style={type.secondary}>No photo</Text>
          </View>
        )}

        <Card>
          <Text style={type.heading}>{listing?.title}</Text>
          <Text style={[type.heading, styles.price]}>{formatPrice(listing?.price)}</Text>
          <InfoRow
            label="Type"
            value={`${PROPERTY_TYPE_LABELS[listing?.type] || listing?.type} · ${
              listing?.listingType
            }${listing?.bhk != null ? ` · ${listing.bhk} BHK` : ''}`}
          />
          <InfoRow label="Zone" value={listing?.zone?.name || 'Hyderabad'} />
          {!!listing?.address && <InfoRow label="Address" value={listing.address} />}
          {!!listing?.facing && <InfoRow label="Facing" value={listing.facing} />}
          {!!listing?.villaType && <InfoRow label="Villa type" value={listing.villaType} />}
          {!!listing?.plotSize && <InfoRow label="Size" value={listing.plotSize} />}
          {!!(listing?.carpetArea || listing?.areaSqft) && (
            <InfoRow label="Area" value={`${listing.carpetArea || listing.areaSqft} sqft`} />
          )}
          {!!listing?.notes && <InfoRow label="Notes" value={listing.notes} />}
        </Card>

        {!!publisher && (
          <Card>
            <Text style={type.heading}>Publisher</Text>
            <View style={styles.pubRow}>
              <RatedAvatar
                uri={publisher.profilePic}
                name={publisher.name}
                ratingAvg={publisher.ratingAvg}
                ratingCount={publisher.ratingCount}
                size={64}
              />
              <View style={styles.pubMeta}>
                <Text style={[type.body, styles.pubName]}>{publisher.name}</Text>
                {!!publisher.agencyName && (
                  <Text style={type.secondary}>{publisher.agencyName}</Text>
                )}
                {!!publisher.phone && <Text style={type.secondary}>{publisher.phone}</Text>}
              </View>
            </View>
          </Card>
        )}

        <Card>
          <Text style={type.heading}>Enquire</Text>
          <Text style={[type.secondary, styles.hint]}>
            Tell the publisher what you need — we will connect you. After you enquire you can
            rate them from My enquiries.
          </Text>
          <Field
            accessibilityLabel="Enquiry message"
            containerStyle={styles.action}
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="I would like a site visit this weekend…"
          />
          <Button title="Send enquiry" onPress={enquire} style={styles.action} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  hero: {
    width: '100%',
    height: 220,
    borderRadius: radius.control,
    backgroundColor: colors.border,
  },
  heroPh: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  price: { marginTop: spacing.xs, color: colors.primary },
  infoRow: { marginTop: spacing.sm },
  hint: { marginTop: spacing.xs },
  action: { marginTop: spacing.md },
  pubRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  pubMeta: { flex: 1 },
  pubName: { fontWeight: '700' },
});
