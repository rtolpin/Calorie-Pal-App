import { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

SplashScreen.preventAutoHideAsync();

async function handleAuthDeepLink(url: string) {
  // ── PKCE flow (?code= param) ────────────────────────────────────────────────
  const codeMatch = url.match(/[?&]code=([^&#]+)/);
  if (codeMatch) {
    const code = decodeURIComponent(codeMatch[1]);
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      router.replace('/(auth)/reset-password');
    } catch {
      Alert.alert(
        'Link Expired',
        'This password reset link has already been used or has expired. Please request a new one from the sign-in screen.',
        [{ text: 'Back to Sign In', onPress: () => router.replace('/(auth)/sign-in') }],
      );
    }
    return;
  }

  // ── Implicit flow (#access_token= fragment) ─────────────────────────────────
  const fragment = url.split('#')[1];
  if (!fragment) return;
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
    if (type === 'recovery') {
      router.replace('/(auth)/reset-password');
    }
  }
}

export default function RootLayout() {
  const { initialize, initialized } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Wait for initialize() to complete before processing deep links so that
  // getSession()'s auth lock is released before setSession() / exchangeCodeForSession()
  // try to acquire it — prevents the Web Locks API "lock stolen" error on web.
  useEffect(() => {
    if (!initialized) return;
    Linking.getInitialURL().then((url) => { if (url) handleAuthDeepLink(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthDeepLink(url));
    return () => sub.remove();
  }, [initialized]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="snap-result"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="edit-entry/[id]"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="edit-exercise/[id]"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="log-exercise"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </>
  );
}
