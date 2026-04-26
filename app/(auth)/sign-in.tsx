import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

export default function SignInScreen() {
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = 'Please enter your email';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Please enter a valid email';
    if (!password) errs.password = 'Please enter your password';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 15000)
      );
      await Promise.race([signIn(email.trim(), password), timeout]);
      router.replace('/(tabs)/');
    } catch (e: any) {
      Alert.alert('Sign In Failed', e.message || 'Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      // Show inline under the email field — works correctly on web and mobile.
      // Alert.alert on web renders a browser popup which is inconsistent.
      setErrors((prev) => ({ ...prev, email: 'Please enter a valid email to reset your password.' }));
      return;
    }
    setErrors((prev) => ({ ...prev, email: undefined }));
    setResetLoading(true);
    setResetSent(null);
    try {
      // Standard Supabase password reset flow:
      // 1. resetPasswordForEmail sends a magic link to the user's email
      // 2. User taps the link → app opens via deep link (caloriepal:// on mobile,
      //    http://localhost:8081 on web)
      // 3. _layout.tsx handleAuthDeepLink exchanges the code for a session
      // 4. App navigates to /(auth)/reset-password
      // 5. User enters new password → updateUser({ password })
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: Linking.createURL('reset-password'),
      });
      if (error) throw error;
      setResetSent(trimmed);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.back}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          <Animated.View entering={FadeInDown.springify()}>
            <View style={styles.logoRow}>
              <Text style={styles.logoEmoji}>🥗</Text>
              <Text style={styles.appName}>
                Calorie<Text style={styles.pal}>Pal</Text>
              </Text>
            </View>

            <Text style={styles.title}>Welcome back! 👋</Text>
            <Text style={styles.subtitle}>Sign in to continue tracking your nutrition</Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
              error={errors.email}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              leftIcon="lock-closed-outline"
              secureToggle
              error={errors.password}
            />

            <TouchableOpacity
              style={styles.forgotRow}
              onPress={handleForgotPassword}
              disabled={resetLoading}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.forgot}>{resetLoading ? 'Sending…' : 'Forgot Password?'}</Text>
            </TouchableOpacity>

            {resetSent && (
              <View style={styles.resetBanner}>
                <Ionicons name="mail-outline" size={18} color={Colors.success} style={{ marginTop: 2 }} />
                <Text style={styles.resetBannerText}>
                  Reset link sent to{' '}
                  <Text style={styles.resetBannerEmail}>{resetSent}</Text>
                  .{'\n'}Tap the link in the email to set a new password.
                </Text>
              </View>
            )}

            <Button
              title="Sign In"
              gradient
              size="lg"
              loading={loading}
              onPress={handleSignIn}
              style={styles.signInBtn}
            />

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.createRow}>
              <Text style={styles.createText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/create-account')}
                accessibilityRole="link"
                accessibilityLabel="Create a new account"
              >
                <Text style={styles.createLink}>Create one</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, paddingTop: 16 },
  back: { marginBottom: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoEmoji: { fontSize: 32 },
  appName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: Colors.text,
  },
  pal: { color: Colors.primary },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: Colors.textLight,
    marginBottom: 28,
  },
  forgotRow: { alignItems: 'flex-end', marginTop: -8, marginBottom: 8 },
  forgot: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.primary,
  },
  signInBtn: { marginTop: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.textLight },
  createRow: { flexDirection: 'row', justifyContent: 'center' },
  createText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: Colors.textLight },
  createLink: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: Colors.primary },
  resetBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.success + '15',
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  resetBannerText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.text,
    flex: 1,
    lineHeight: 19,
  },
  resetBannerEmail: {
    fontFamily: 'Nunito_700Bold',
  },
});
