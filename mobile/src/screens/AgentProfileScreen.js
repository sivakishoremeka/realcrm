import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import api from '../api/client';
import LoadingOverlay from '../components/LoadingOverlay';
import ZonePicker from '../components/ZonePicker';
import ZoneMapPreview from '../components/ZoneMapPreview';
import ProfileAvatarPicker from '../components/ProfileAvatarPicker';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import ScreenHeader from '../components/ScreenHeader';
import { colors, radius, spacing, TOUCH_TARGET, type } from '../constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function AgentProfileScreen() {
  const { user, logout, updateUser, refreshSessionUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('0');
  const [zones, setZones] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [igStatus, setIgStatus] = useState(null);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Key of the expanded section; one at a time keeps the screen short.
  const [open, setOpen] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [zonesRes, meRes, igRes] = await Promise.all([
        api.get('/api/zones'),
        api.get('/api/agents/me'),
        api.get('/api/instagram/status').catch(() => ({ data: null })),
      ]);
      setZones(zonesRes.data);
      setPhone(meRes.data.phone || '');
      setAgencyName(meRes.data.agencyName || '');
      setBio(meRes.data.bio || '');
      setYearsExperience(String(meRes.data.yearsExperience ?? 0));
      setSelectedZones((meRes.data.zones || []).map((z) => z._id));
      setHasOpenaiKey(!!meRes.data.hasOpenaiKey);
      setOpenaiModel(meRes.data.openaiModel || 'gpt-4o-mini');
      setOpenaiKeyInput('');
      setIgStatus(igRes.data);
      if (meRes.data.user?.profilePic != null || meRes.data.ratingAvg != null) {
        await updateUser({
          profilePic: meRes.data.user?.profilePic || user?.profilePic,
          ratingAvg: meRes.data.ratingAvg ?? user?.ratingAvg ?? 0,
          ratingCount: meRes.data.ratingCount ?? user?.ratingCount ?? 0,
        });
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      refreshSessionUser();
      load();
    }, [])
  );

  const onSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/api/agents/me', {
        phone: phone.trim(),
        agencyName: agencyName.trim(),
        bio,
        yearsExperience: Number(yearsExperience) || 0,
        zoneIds: selectedZones,
        complete: selectedZones.length > 0 && !!phone.trim(),
      });
      await updateUser({ onboardingComplete: !!data.onboardingComplete });
      Alert.alert('Saved', 'Profile updated');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const connectInstagram = async () => {
    try {
      setSaving(true);
      const { data } = await api.get('/api/instagram/oauth-url');
      await WebBrowser.openBrowserAsync(data.url);
      await load();
    } catch (err) {
      Alert.alert(
        'Instagram',
        err.response?.data?.message ||
          'Could not start Instagram connect. Configure META_APP_ID on the server.'
      );
    } finally {
      setSaving(false);
    }
  };

  const disconnectInstagram = async () => {
    try {
      setSaving(true);
      await api.post('/api/instagram/disconnect');
      await load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Disconnect failed');
    } finally {
      setSaving(false);
    }
  };

  const saveOpenaiKey = async () => {
    if (!openaiKeyInput.trim()) {
      Alert.alert('OpenAI key', 'Paste your API key from platform.openai.com');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/api/agents/me/openai-key', {
        apiKey: openaiKeyInput.trim(),
        model: openaiModel.trim() || 'gpt-4o-mini',
      });
      setHasOpenaiKey(!!data.hasOpenaiKey);
      setOpenaiKeyInput('');
      Alert.alert('Saved', data.message || 'Your OpenAI key is saved securely.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save OpenAI key');
    } finally {
      setSaving(false);
    }
  };

  const clearOpenaiKey = async () => {
    Alert.alert('Remove OpenAI key', 'Caption generation will stop until you add a key again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const { data } = await api.put('/api/agents/me/openai-key', { apiKey: '' });
            setHasOpenaiKey(!!data.hasOpenaiKey);
            setOpenaiKeyInput('');
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not remove key');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const toggle = (key) => setOpen((current) => (current === key ? null : key));
  const personalSummary = [phone.trim(), agencyName.trim()].filter(Boolean).join(' · ');
  const areaCount = selectedZones.length;
  const igConnected = !!igStatus?.connected;
  const igHandle = `@${igStatus?.instagramUsername || 'business'}`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LoadingOverlay visible={loading || saving} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Profile" />
        <View style={styles.body}>
          <Card style={styles.hero}>
            <ProfileAvatarPicker
              user={user}
              onUpdated={(next) => updateUser(next)}
              showRating
            />
            <Text style={styles.heroName} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={styles.heroEmail} numberOfLines={1}>
              {user?.email}
            </Text>
          </Card>

          <Text style={styles.group} accessibilityRole="header">
            Account
          </Text>
          <Section
            icon="person-outline"
            title="Personal details"
            summary={personalSummary || 'Add phone and agency'}
            done={!!phone.trim()}
            open={open === 'personal'}
            onToggle={() => toggle('personal')}
          >
            <Field
              label="Phone"
              containerStyle={styles.firstField}
              value={phone}
              onChangeText={setPhone}
            />
            <Field label="Agency" value={agencyName} onChangeText={setAgencyName} />
            <Field
              label="Years experience"
              keyboardType="number-pad"
              value={yearsExperience}
              onChangeText={setYearsExperience}
            />
            <Field label="Bio" multiline value={bio} onChangeText={setBio} />
            <Button title="Save profile" onPress={onSave} style={styles.cardAction} />
          </Section>
          <Section
            icon="map-outline"
            title="Areas served"
            summary={
              areaCount ? `${areaCount} area${areaCount === 1 ? '' : 's'} selected` : 'No areas selected'
            }
            done={areaCount > 0}
            open={open === 'areas'}
            onToggle={() => toggle('areas')}
          >
            <ZonePicker
              zones={zones}
              selectedIds={selectedZones}
              onChange={setSelectedZones}
              multi
              placeholder="Select areas served"
            />
            <ZoneMapPreview zones={zones} selectedIds={selectedZones} height={200} />
            <Button title="Save profile" onPress={onSave} style={styles.cardAction} />
          </Section>

          <Text style={styles.group} accessibilityRole="header">
            Integrations
          </Text>
          <Section
            icon="sparkles-outline"
            title="AI captions (OpenAI)"
            summary={hasOpenaiKey ? 'Key saved' : 'Not set up'}
            done={hasOpenaiKey}
            open={open === 'openai'}
            onToggle={() => toggle('openai')}
          >
            <Text style={styles.cardText}>
              Paste your personal OpenAI API key. Reel captions use your free/paid credits — not a
              shared platform key. Keys are stored encrypted and never shown again.
            </Text>
            <Field
              label="OpenAI API key"
              value={openaiKeyInput}
              onChangeText={setOpenaiKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder={hasOpenaiKey ? '•••• sk-... (enter to replace)' : 'sk-...'}
            />
            <Field
              label="Model"
              value={openaiModel}
              onChangeText={setOpenaiModel}
              autoCapitalize="none"
              placeholder="gpt-4o-mini"
            />
            <Button
              title={hasOpenaiKey ? 'Replace OpenAI key' : 'Save OpenAI key'}
              onPress={saveOpenaiKey}
              variant="secondary"
              style={styles.cardAction}
            />
            {hasOpenaiKey && (
              <Button
                title="Remove key"
                onPress={clearOpenaiKey}
                variant="danger"
                style={styles.cardActionNext}
              />
            )}
          </Section>
          <Section
            icon="logo-instagram"
            title="Instagram Reels"
            summary={igConnected ? igHandle : 'Not connected'}
            done={igConnected}
            open={open === 'instagram'}
            onToggle={() => toggle('instagram')}
          >
            <Text style={styles.cardText}>
              {igConnected
                ? `Connected as ${igHandle}`
                : 'Connect an Instagram Business account linked to a Facebook Page to auto-publish Reels.'}
            </Text>
            <Button
              title={igConnected ? 'Disconnect' : 'Connect Instagram'}
              onPress={igConnected ? disconnectInstagram : connectInstagram}
              variant={igConnected ? 'danger' : 'secondary'}
              style={styles.cardActionNext}
            />
          </Section>

          <Button title="Logout" onPress={logout} variant="danger" style={styles.logout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Collapsible settings row: icon, title and a one-line status; children show when open. */
function Section({ icon, title, summary, done, open, onToggle, children }) {
  return (
    <Card style={styles.sectionCard}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${summary}`}
        style={({ pressed }) => [styles.sectionHead, pressed && styles.sectionPressed]}
      >
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.sectionText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={[styles.sectionSummary, done && styles.sectionDone]} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  body: { paddingHorizontal: spacing.lg },
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  heroName: { ...type.heading },
  heroEmail: { ...type.secondary, marginTop: 2 },
  group: {
    ...type.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionCard: { padding: 0, marginBottom: spacing.sm },
  sectionHead: {
    borderRadius: radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET + spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionPressed: { backgroundColor: colors.primaryLight },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sectionText: { flex: 1, marginRight: spacing.sm },
  sectionTitle: { ...type.body, fontWeight: '600' },
  sectionSummary: { ...type.secondary, marginTop: 2 },
  sectionDone: { color: colors.success },
  sectionBody: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  firstField: { marginTop: -spacing.md },
  cardText: { ...type.secondary },
  cardAction: { marginTop: spacing.md },
  cardActionNext: { marginTop: spacing.sm },
  logout: { marginTop: spacing.lg },
});
