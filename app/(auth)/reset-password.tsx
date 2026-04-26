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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ new?: string; confirm?: string }>({});

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
    setLoading(true);
    try {
      // Fast-fail: verify the recovery session exists before hitting the network.
      // Without this check, updateUser hangs for the full timeout duration when
      // the session is missing (e.g. PKCE code was never exchanged, or the link
      // was pre-fetched by an email-security scanner and the code was consumed).
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert(
          'Link Expired',
          'Your password reset session has expired or the link was already used. Please request a new one from the sign-in screen.',
          [{ text: 'Back to Sign In', onPress: () => router.replace('/(auth)/sign-in') }],
        );
        return;
      }

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 15000)
      );
      const { error } = await Promise.race([
        supabase.auth.updateUser({ password: newPassword }),
        timeout,
      ]);
      if (error) throw error;
      // updateUser with a recovery token creates a valid authenticated session —
      // navigate directly to the app instead of asking the user to sign in again.
      Alert.alert(
        'Password Updated ✅',
        'Your password has been changed successfully.',
        [{ text: 'Continue', onPress: () => router.replace('/(tabs)/') }]
      );
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid jwt')) {
        Alert.alert(
          'Link Expired',
          'This password reset link has expired. Please request a new one from the sign-in screen.',
          [{ text: 'Back to Sign In', onPress: () => router.replace('/(auth)/sign-in') }]
        );
      } else {
        Alert.alert('Reset Failed', msg || 'Failed to update password. Please try again.');
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
              onPress={handleReset}
              style={styles.btn}
            />

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
