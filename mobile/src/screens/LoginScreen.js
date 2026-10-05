import React, { useState } from 'react';
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
import ErrorBoundary from '../components/ErrorBoundary';
import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import { colors, spacing, TOUCH_TARGET, type } from '../constants/theme';

export default function LoginScreen({ navigation }) {
  const { login, apiUrl, updateApiUrl } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [baseUrl, setBaseUrl] = useState(apiUrl);
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showServer, setShowServer] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter email and password.');
      return;
    }
    setLoading(true);
    try {
      if (baseUrl !== apiUrl) {
        await updateApiUrl(baseUrl);
      }
      await login(email.trim(), password);
    } catch (err) {
      const isNetwork =
        err.message === 'Network Error' ||
        err.code === 'ECONNABORTED' ||
        err.code === 'ERR_NETWORK';
      const message = isNetwork
        ? `Cannot reach API at ${baseUrl || apiUrl}.\n\nEmulator: http://10.0.2.2:5000\nPhone: http://YOUR_PC_LAN_IP:5000\n\nOpen Server settings and confirm the URL; keep backend running.`
        : err.response?.data?.message || err.message || 'Login failed';
      Alert.alert('Login error', message);
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.brand} accessibilityRole="header">
              Your Bhoomi
            </Text>
            <Text style={styles.subtitle}>Match buyers to the right agents</Text>
          </View>

          <Card style={styles.form}>
            <ErrorBoundary>
              <GoogleSignInButton label="Sign in with Google" onBusyChange={setGoogleBusy} />
            </ErrorBoundary>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or email</Text>
              <View style={styles.divider} />
            </View>

            <Field
              label="Email"
              containerStyle={styles.firstField}
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
              placeholder="••••••••"
            />

            <Button title="Sign In" onPress={onSubmit} style={styles.submit} />

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Register')}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <Text style={styles.link}>
                New here? <Text style={styles.linkBold}>Create an account</Text>
              </Text>
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
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder="http://10.0.2.2:5000"
                hint={
                  'Emulator: http://10.0.2.2:5000\n' +
                  'Phone on Wi‑Fi: http://192.168.1.6:5000 (this PC)'
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  hero: {
    marginBottom: spacing.xl,
  },
  brand: {
    ...type.title,
    fontSize: 34,
    lineHeight: 40,
    color: colors.primary,
  },
  subtitle: {
    ...type.secondary,
    marginTop: spacing.xs,
  },
  form: {
    padding: spacing.lg,
    marginBottom: 0,
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
    fontWeight: '700',
  },
});
