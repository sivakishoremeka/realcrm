import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import LoadingOverlay from '../components/LoadingOverlay';
import GoogleSignInButton from '../components/GoogleSignInButton';
import Button from '../components/Button';
import Card from '../components/Card';
import ChipRow from '../components/ChipRow';
import Field from '../components/Field';
import { colors, spacing, TOUCH_TARGET, type } from '../constants/theme';

const ROLES = ['publisher', 'customer'];
const ROLE_LABELS = { publisher: 'Publisher', customer: 'Customer' };

function networkHint(err, apiUrl) {
  const isNetwork =
    err.message === 'Network Error' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ERR_NETWORK';
  if (!isNetwork) return err.response?.data?.message || err.message || 'Registration failed';
  return (
    `Cannot reach API at ${apiUrl}.\n\n` +
    `• Android emulator: http://10.0.2.2:5000\n` +
    `• Physical phone (same Wi‑Fi): http://YOUR_PC_LAN_IP:5000\n` +
    `• Ensure backend is running (npm run dev in backend/)\n\n` +
    `Open Server settings below and set the correct URL.`
  );
}

export default function RegisterScreen({ navigation }) {
  const { register, apiUrl, updateApiUrl } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('publisher');
  const [baseUrl, setBaseUrl] = useState(apiUrl);
  const [showServer, setShowServer] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    setBaseUrl(apiUrl);
  }, [apiUrl]);

  const onSubmit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Invalid form', 'Name, email, and password (6+ chars) are required.');
      return;
    }
    setLoading(true);
    const url = (baseUrl || apiUrl).trim().replace(/\/$/, '');
    try {
      await updateApiUrl(url);
      await register(name.trim(), email.trim(), password, role);
    } catch (err) {
      Alert.alert('Register error', networkHint(err, url));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LoadingOverlay visible={loading || googleBusy} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>Your Bhoomi</Text>
          <Text style={styles.title} accessibilityRole="header">
            Create account
          </Text>
          <Text style={styles.subtitle}>
            Publisher posts homes (as Agent or Owner). Customer browses & enquires.
            Use admin@realcrm.app for Business Owner.
          </Text>

          <Card style={styles.form}>
            <Text style={styles.label}>I am a</Text>
            <ChipRow options={ROLES} value={role} onSelect={setRole} labels={ROLE_LABELS} />

            <GoogleSignInButton
              label="Sign up with Google"
              onBusyChange={setGoogleBusy}
              role={role}
            />

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or email</Text>
              <View style={styles.divider} />
            </View>

            <Field
              label="Name"
              containerStyle={styles.firstField}
              value={name}
              onChangeText={setName}
              placeholder="Ada Lovelace"
            />

            <Field
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
            />

            <Field
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Min 6 characters"
            />

            <Button title="Register" onPress={onSubmit} style={styles.submit} />

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <Text style={[styles.link, styles.linkBold]}>Already have an account? Sign in</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showServer }}
              onPress={() => setShowServer((v) => !v)}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <Text style={styles.link}>
                {showServer ? 'Hide server settings' : 'Server settings'}
              </Text>
            </Pressable>

            {showServer && (
              <Field
                label="API Base URL"
                containerStyle={styles.firstField}
                autoCapitalize="none"
                autoCorrect={false}
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder="http://192.168.1.6:5000"
                hint={
                  'Emulator: http://10.0.2.2:5000\n' +
                  'Phone on Wi‑Fi: http://192.168.1.6:5000 (this PC)\n' +
                  'Backend must be running on port 5000.'
                }
              />
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
    flexGrow: 1,
  },
  brand: {
    ...type.title,
    color: colors.primary,
  },
  title: {
    ...type.heading,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...type.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  form: {
    padding: spacing.lg,
    marginBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...type.caption,
    marginHorizontal: spacing.sm,
  },
  firstField: {
    marginTop: -spacing.sm,
  },
  submit: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  linkRow: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  link: {
    ...type.secondary,
    textAlign: 'center',
  },
  linkBold: {
    color: colors.primary,
    fontWeight: '600',
  },
});
