import { useEffect } from 'react';
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
  // Supabase auth links arrive as: caloriepal://[path]#access_token=...&type=...
  const fragment = url.split('#')[1];
  if (!fragment) return;
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
    if (type === 'recovery') {
      // Password reset link — navigate to the set-new-password screen
      router.replace('/(auth)/reset-password');
    }
    // For type === 'signup' (email confirmation), onAuthStateChange handles navigation
  }
}

export default function RootLayout() {
  const { initialize } = useAuthStore();

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

  useEffect(() => {
    // Cold start: app was launched by tapping the confirmation link
    Linking.getInitialURL().then((url) => { if (url) handleAuthDeepLink(url); });
    // Warm start: app was already running when the link was tapped
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthDeepLink(url));
    return () => sub.remove();
  }, []);

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
