import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../api/client';
import RatedAvatar from './RatedAvatar';
import { colors, spacing, type } from '../constants/theme';

/** Upload / change the signed-in user's profile picture. */
export default function ProfileAvatarPicker({
  user,
  onUpdated,
  size = 88,
  showRating = true,
}) {
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
      aspect: [1, 1],
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const form = new FormData();
    form.append('avatar', {
      uri: asset.uri,
      name: asset.fileName || `avatar-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });

    setBusy(true);
    try {
      const { data } = await api.post('/api/auth/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      onUpdated?.(data.user);
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={pick}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Change profile picture"
      >
        <RatedAvatar
          uri={user?.profilePic}
          name={user?.name}
          ratingAvg={showRating ? user?.ratingAvg : 0}
          ratingCount={showRating ? user?.ratingCount : 0}
          size={size}
          showLabel={showRating}
        />
      </Pressable>
      <Text style={styles.hint}>{busy ? 'Uploading…' : 'Tap photo to change'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.md },
  hint: { ...type.caption, marginTop: spacing.xs, color: colors.textMuted },
});
