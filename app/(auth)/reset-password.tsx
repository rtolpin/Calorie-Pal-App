import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/Colors';

type StatusBanner = { type: 'success' | 'error'; message: string } | null;

export default function ResetPasswordScreen() {
  const { syncSession } = useAuthStore();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ new?: string; confirm?: string }>({});
  const [status, setStatus] = useState<StatusBanner>(null);

  const validate = (): boolean => {
    const errs: { new?: string; confirm?: string } = {};
    if (!newPassword) {
      errs.new = 'Please enter a new password';
    } else if (newPassword.length < 6) {
      errs.new = 'Password must be at least 6 characters';
    }
    if (!confirmPassword) {
      errs.confirm = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      errs.confirm = 'Passwords do not match';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setStatus(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus({
          type: 'error',
          message: 'Your reset session has expired or was already used. Please request a new code from the sign-in screen.',
        });
        return;
      }

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 15000)
      );
      const { data, error } = await Promise.race([
        supabase.auth.updateUser({ password: newPassword }),
        timeout,
      ]);

      // Per Supabase docs, success = error is null AND data.user is populated.
      // Checking both guards against any unexpected partial-success response.
      if (error) throw error;
      if (!data?.user) throw new Error('Password could not be updated. Please try again.');

      // Immediately sync the new authenticated session into the store so the
      // tabs guard sees a valid session the moment the user taps "Continue".
      await syncSession();

      setStatus({ type: 'success', message: 'Your password has been changed successfully.' });
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid jwt')) {
        setStatus({
          type: 'error',
          message: 'This reset session has expired. Please request a new code from the sign-in screen.',
        });
      } else {
        setStatus({
          type: 'error',
          message: msg || 'Failed to update password. Please try again.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/sign-in')}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          <Animated.View entering={FadeInDown.springify()}>
            <View style={styles.iconRow}>
              <Text style={styles.lockIcon}>🔐</Text>
            </View>

            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
              Choose a strong password — at least 6 characters.
            </Text>

            <Input
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              leftIcon="lock-closed-outline"
              secureToggle
              autoFocus
              error={errors.new}
            />

            <Input
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat your new password"
              leftIcon="lock-closed-outline"
              secureToggle
              error={errors.confirm}
            />

            <Button
              title="Set New Password"
              gradient
              size="lg"
              loading={loading}
              disabled={status?.type === 'success'}
              onPress={handleReset}
              style={styles.btn}
            />

            {status && (
              <View style={[styles.banner, status.type === 'success' ? styles.bannerSuccess : styles.bannerError]}>
                <Ionicons
                  name={status.type === 'success' ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={status.type === 'success' ? Colors.success : Colors.error}
                />
                <Text style={[styles.bannerText, status.type === 'success' ? styles.bannerTextSuccess : styles.bannerTextError]}>
                  {status.message}
                </Text>
              </View>
            )}

            {status?.type === 'success' && (
              <Button
                title="Continue to App →"
                gradient
                size="lg"
                onPress={() => router.replace('/(tabs)/')}
                style={styles.btn}
              />
            )}

            {status?.type === 'error' && (
              <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')} style={styles.backToSignIn}>
                <Text style={styles.backToSignInText}>← Back to Sign In</Text>
              </TouchableOpacity>
            )}

            <View style={styles.tipBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textLight} />
              <Text style={styles.tipText}>
                Your reset code expires after 1 hour. If it has expired, request a new one from the sign-in screen.
              </Text>
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
  iconRow: { alignItems: 'center', marginBottom: 20 },
  lockIcon: { fontSize: 52 },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.textLight,
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: { marginTop: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  bannerSuccess: {
    backgroundColor: Colors.success + '15',
    borderColor: Colors.success,
  },
  bannerError: {
    backgroundColor: Colors.error + '15',
    borderColor: Colors.error,
  },
  bannerText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  bannerTextSuccess: { color: Colors.success },
  bannerTextError: { color: Colors.error },
  backToSignIn: { alignItems: 'center', marginTop: 12 },
  backToSignInText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.primary,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 24,
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 14,
  },
  tipText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.textLight,
    flex: 1,
    lineHeight: 19,
  },
});
