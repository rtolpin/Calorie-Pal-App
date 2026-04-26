import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

const OTP_LENGTH = 8;

export default function VerifyOTPScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();

  const [otp, setOtp]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]       = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!email) {
      router.replace('/(auth)/sign-in');
      return;
    }
    // Small delay lets the screen animation finish before the keyboard opens
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleOtpChange = (value: string) => {
    setOtp(value.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH));
    setError('');
  };

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setError('Please enter all 8 digits.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timed out. Please check your connection and try again.')),
          15000,
        ),
      );
      const verifyResult = await Promise.race([
        supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' }),
        timeout,
      ]);
      if (verifyResult.error) throw verifyResult.error;
      // Explicitly re-set the recovery session so reset-password.tsx has a
      // guaranteed fresh token. onAuthStateChange skips PASSWORD_RECOVERY so
      // the session only lives in the Supabase client, not the auth store.
      const recoverySession = verifyResult.data?.session;
      if (recoverySession) {
        await supabase.auth.setSession({
          access_token: recoverySession.access_token,
          refresh_token: recoverySession.refresh_token,
        });
      }
      router.replace('/(auth)/reset-password');
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase();
      if (
        msg.includes('expired') ||
        msg.includes('invalid') ||
        msg.includes('token') ||
        msg.includes('otp')
      ) {
        setError('That code is incorrect or has expired. Please request a new one.');
      } else {
        setError(e?.message || 'Verification failed. Please try again.');
      }
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError('');
    setOtp('');
    try {
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'caloriepal://reset-password',
      });
      if (resendError) throw resendError;
      Alert.alert('Code Resent ✉️', `A new code has been sent to ${email}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not resend code. Please try again.');
    } finally {
      setResending(false);
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
            onPress={() => router.back()}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          <Animated.View entering={FadeInDown.springify()}>
            <View style={styles.iconRow}>
              <Text style={styles.icon}>✉️</Text>
            </View>

            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.subtitle}>
              We sent an 8-digit reset code to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            {/* 6 visual digit boxes — tap to open keyboard */}
            <TouchableOpacity
              style={styles.otpRow}
              onPress={() => inputRef.current?.focus()}
              activeOpacity={1}
              accessibilityLabel="Enter the 6-digit code"
              accessibilityRole="button"
              testID="otp-row"
            >
              {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.otpBox,
                    i < otp.length && styles.otpBoxFilled,
                    i === otp.length && styles.otpBoxActive,
                    !!error && styles.otpBoxError,
                  ]}
                >
                  <Text style={styles.otpChar}>{otp[i] ?? ''}</Text>
                </View>
              ))}
            </TouchableOpacity>

            {/* Hidden input that actually captures keystrokes */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              caretHidden
              testID="otp-input"
              accessibilityLabel="6-digit code input"
            />

            {error ? (
              <Text style={styles.errorText} testID="otp-error">{error}</Text>
            ) : null}

            <Button
              title="Verify Code"
              gradient
              size="lg"
              loading={loading}
              onPress={handleVerify}
              style={styles.btn}
            />

            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive it? </Text>
              <TouchableOpacity
                onPress={handleResend}
                disabled={resending}
                accessibilityRole="button"
                accessibilityLabel="Resend code"
                testID="resend-btn"
              >
                <Text style={styles.resendLink}>
                  {resending ? 'Sending…' : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tipBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textLight} />
              <Text style={styles.tipText}>
                The 8-digit code expires after 1 hour. Check your spam folder if it doesn't arrive.
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
  icon: { fontSize: 52 },
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
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: {
    fontFamily: 'Nunito_700Bold',
    color: Colors.text,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
  },
  otpBox: {
    width: 34,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '0D',
  },
  otpBoxActive: {
    borderColor: Colors.primary,
    borderWidth: 2.5,
    backgroundColor: Colors.surface,
  },
  otpBoxError: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '0D',
  },
  otpChar: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: Colors.text,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  errorText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  btn: { marginTop: 8 },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  resendLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.textLight,
  },
  resendLink: {
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
