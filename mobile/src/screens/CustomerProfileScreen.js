import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import ProfileAvatarPicker from '../components/ProfileAvatarPicker';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, type } from '../constants/theme';

export default function CustomerProfileScreen() {
  const { user, logout, apiUrl, updateUser, refreshSessionUser } = useAuth();

  useFocusEffect(
    useCallback(() => {
      refreshSessionUser();
    }, [refreshSessionUser])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileAvatarPicker
          user={user}
          onUpdated={(next) => updateUser(next)}
          showRating={false}
        />
        <Card style={styles.card}>
          <Text style={[styles.label, styles.firstLabel]}>Name</Text>
          <Text style={styles.value}>{user?.name || '—'}</Text>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || '—'}</Text>
          <Text style={styles.label}>Persona</Text>
          <Text style={styles.value}>Customer (Buy / Rent)</Text>
          <Text style={styles.label}>API</Text>
          <Text style={styles.valueMuted}>{apiUrl}</Text>
        </Card>
        <Button title="Log out" onPress={logout} variant="danger" style={styles.logout} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { padding: spacing.lg },
  label: { ...type.caption, marginTop: spacing.md, textTransform: 'uppercase' },
  firstLabel: { marginTop: 0 },
  value: { ...type.body, marginTop: spacing.xs, fontWeight: '600' },
  valueMuted: { ...type.secondary, marginTop: spacing.xs },
  logout: { marginTop: spacing.lg },
});
