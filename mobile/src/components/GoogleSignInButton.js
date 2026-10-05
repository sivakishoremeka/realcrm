import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../context/AuthContext';
import { GOOGLE_WEB_CLIENT_ID } from '../constants/googleAuth';
import { colors, radius, spacing, TOUCH_TARGET } from '../constants/theme';

const GOOGLE_RED = '#EA4335';

WebBrowser.maybeCompleteAuthSession();

function buildNonce() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export default function GoogleSignInButton({
  label = 'Continue with Google',
  onBusyChange,
  role,
}) {
  const { loginWithGoogle, apiUrl, updateApiUrl } = useAuth();
  const [busy, setBusy] = useState(false);

  const setBusyState = (value) => {
    setBusy(value);
    onBusyChange?.(value);
  };

  const onPress = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert(
        'Not configured',
        'Add your Google Web client ID in mobile/src/constants/googleAuth.js'
      );
      return;
    }

    setBusyState(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'realcrm',
        path: 'oauthredirect',
      });

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${encodeURIComponent(GOOGLE_WEB_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=id_token` +
        `&scope=${encodeURIComponent('openid profile email')}` +
        `&nonce=${encodeURIComponent(buildNonce())}` +
        `&prompt=select_account`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== 'success' || !result.url) {
        if (result.type !== 'dismiss' && result.type !== 'cancel') {
          Alert.alert('Google sign-in', 'Sign-in was not completed.');
        }
        return;
      }

      const hash = result.url.includes('#') ? result.url.split('#')[1] : '';
      const query = result.url.includes('?') ? result.url.split('?')[1].split('#')[0] : '';
      const params = new URLSearchParams(hash || query);
      const idToken = params.get('id_token');

      if (!idToken) {
        Alert.alert(
          'Google sign-in',
          `No ID token returned.\nAdd this redirect URI in Google Cloud Console:\n${redirectUri}`
        );
        return;
      }

      await updateApiUrl(apiUrl);
      await loginWithGoogle(idToken, role);
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Google sign-in failed';
      Alert.alert('Google sign-in', message);
    } finally {
      setBusyState(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        busy && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={busy}
    >
      <View style={styles.row}>
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Text style={styles.g}>G</Text>
            <Text style={styles.text}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  g: {
    fontSize: 18,
    fontWeight: '700',
    color: GOOGLE_RED,
    marginRight: spacing.sm,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
});
