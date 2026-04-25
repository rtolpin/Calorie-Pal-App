import React from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/Colors';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { continueAsGuest } = useAuthStore();

  const handleGuest = () => {
    continueAsGuest();
    router.replace('/(tabs)/');
  };

  return (
    <LinearGradient
      colors={['#FF6B35', '#FFB347', '#FFE66D']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🥗</Text>
          </View>
          <Text style={styles.appName}>
            Calorie<Text style={styles.appNamePal}>Pal</Text>
          </Text>
          <Text style={styles.tagline}>Your personal nutrition companion 🥗</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.statsRow}>
          {[
            { emoji: '📷', label: 'Snap meals' },
            { emoji: '🤖', label: 'AI analysis' },
            { emoji: '📊', label: 'Track macros' },
          ].map((item, i) => (
            <View key={i} style={styles.statItem}>
              <Text style={styles.statEmoji}>{item.emoji}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.buttonsContainer}>
          <View style={styles.card}>
            <Button
              title="Create Free Account"
              size="lg"
              gradient
              style={styles.btn}
              onPress={() => router.push('/(auth)/create-account')}
            />
            <Button
              title="Sign In"
              variant="outline"
              size="lg"
              style={[styles.btn, styles.btnOutline]}
              onPress={() => router.push('/(auth)/sign-in')}
            />
            <View style={styles.guestDivider}>
              <View style={styles.guestDividerLine} />
              <Text style={styles.guestDividerText}>or try it first</Text>
              <View style={styles.guestDividerLine} />
            </View>

            <TouchableOpacity
              style={styles.guestBtn}
              onPress={handleGuest}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Continue as Guest — no account needed"
            >
              <Text style={styles.guestBtnArrow}>👇</Text>
              <View style={styles.guestBtnTextContainer}>
                <Text style={styles.guestBtnTitle}>Continue as Guest</Text>
                <Text style={styles.guestBtnSubtitle}>No account needed · Demo the full app</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.guestNote}>
              Guest data is stored locally on this device only.
            </Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 24 },
  heroSection: { alignItems: 'center', paddingTop: 40 },
  logoContainer: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  logoEmoji: { fontSize: 60 },
  appName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 48,
    color: Colors.textWhite,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  appNamePal: { color: '#1A1A2E' },
  tagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  statItem: { alignItems: 'center', gap: 6 },
  statEmoji: { fontSize: 28 },
  statLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.textWhite,
  },
  buttonsContainer: { width: '100%' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  btn: { width: '100%' },
  btnOutline: { borderColor: Colors.primary },
  guestDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  guestDividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  guestDividerText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.secondary + '18',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    width: '100%',
  },
  guestBtnArrow: { fontSize: 22 },
  guestBtnTextContainer: { flex: 1 },
  guestBtnTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: Colors.secondary,
  },
  guestBtnSubtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  guestNote: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 2,
  },
});
