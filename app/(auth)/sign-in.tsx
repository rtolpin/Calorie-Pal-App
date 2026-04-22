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
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/Colors';

export default function SignInScreen() {
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
      await signIn(email.trim(), password);
      router.replace('/(tabs)/');
    } catch (e: any) {
      Alert.alert('Sign In Failed', e.message || 'Please check your credentials and try again.');
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
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
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

            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgot}>Forgot Password?</Text>
            </TouchableOpacity>

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
              <TouchableOpacity onPress={() => router.push('/(auth)/create-account')}>
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
});
