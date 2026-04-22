import React, { useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/Colors';

// CameraView is only imported on native to avoid web compatibility issues
const NativeCamera = Platform.OS !== 'web'
  ? require('expo-camera')
  : null;

export default function SnapScreen() {
  const [permission, requestPermission] = NativeCamera
    ? NativeCamera.useCameraPermissions()
    : [{ granted: false }, async () => {}];
  const cameraRef = useRef<any>(null);
  const [flash, setFlash] = useState<'on' | 'off'>('off');
  const { setCapturedPhoto } = useFoodLogStore();
  const { isGuest, guestScanCount, incrementGuestScan } = useAuthStore();

  const shutterScale = useSharedValue(1);
  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutterScale.value }] }));

  const checkGuestLimit = (label: string) => {
    if (isGuest && guestScanCount >= 3) {
      Alert.alert(
        'Scan Limit Reached',
        `Guest users can scan up to 3 meals. Create a free account for unlimited scans!`,
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Create Account', onPress: () => router.push('/(auth)/create-account') },
        ]
      );
      return true;
    }
    return false;
  };

  const handleCapture = async () => {
    if (checkGuestLimit('capture')) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    shutterScale.value = withSequence(
      withTiming(0.85, { duration: 80 }),
      withTiming(1, { duration: 120 })
    );

    try {
      const photo = await cameraRef.current?.takePictureAsync({
        base64: true,
        quality: 0.8,
        exif: false,
      });

      if (!photo?.uri || !photo.base64) {
        Alert.alert('Error', 'Failed to capture photo. Please try again.');
        return;
      }

      if (isGuest) incrementGuestScan();
      setCapturedPhoto(photo.uri, photo.base64);
      router.push('/snap-result');
    } catch {
      Alert.alert('Camera Error', 'Unable to take photo. Please try again.');
    }
  };

  const handlePickImage = async () => {
    if (checkGuestLimit('pick')) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Error', 'Could not load image data. Please try again.');
        return;
      }
      if (isGuest) incrementGuestScan();
      setCapturedPhoto(asset.uri, asset.base64);
      router.push('/snap-result');
    }
  };

  // Web: camera capture not supported — show upload-only screen
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.webScreen}>
        <Animated.View entering={FadeInDown.springify()} style={styles.webCard}>
          <Text style={styles.webEmoji}>🍽️</Text>
          <Text style={styles.webTitle}>Analyze a Meal</Text>
          <Text style={styles.webSubtitle}>
            Upload a photo of your meal and CaloriePal will analyze its nutritional content.
          </Text>
          {isGuest && (
            <View style={styles.scanBadgeWeb}>
              <Text style={styles.scanBadgeText}>{3 - guestScanCount} free scans remaining</Text>
            </View>
          )}
          <TouchableOpacity style={styles.webUploadBtn} onPress={handlePickImage}>
            <Ionicons name="cloud-upload-outline" size={28} color={Colors.textWhite} />
            <Text style={styles.webUploadText}>Upload Photo</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // Native: permission not yet determined
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <Text style={styles.permissionEmoji}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          CaloriePal needs camera access to snap and analyze your meals
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { CameraView } = NativeCamera;

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
        barcodeScannerSettings={{ barcodeTypes: [] }}
      />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Text style={styles.snapTitle}>Snap a Meal 🍽️</Text>
          <TouchableOpacity
            onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}
            style={styles.flashBtn}
          >
            <Ionicons
              name={flash === 'on' ? 'flash' : 'flash-off'}
              size={24}
              color={Colors.textWhite}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.frameContainer}>
          <Animated.View entering={FadeIn} style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </Animated.View>
          <Text style={styles.frameHint}>Position your meal in the frame</Text>
        </View>

        {isGuest && (
          <View style={styles.scanBadge}>
            <Text style={styles.scanBadgeText}>
              {3 - guestScanCount} free scans remaining
            </Text>
          </View>
        )}

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.galleryBtn} onPress={handlePickImage}>
            <Ionicons name="images-outline" size={28} color={Colors.textWhite} />
            <Text style={styles.galleryText}>Gallery</Text>
          </TouchableOpacity>

          <Animated.View style={shutterStyle}>
            <TouchableOpacity style={styles.shutter} onPress={handleCapture}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.shutterSpacer} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  snapTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: Colors.textWhite,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  flashBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
  },
  frameContainer: { alignItems: 'center' },
  frame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.textWhite,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  frameHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 12,
  },
  scanBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  scanBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.accent1,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: 40,
  },
  galleryBtn: { alignItems: 'center', gap: 4 },
  galleryText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textWhite,
  },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.textWhite,
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.textWhite,
  },
  shutterSpacer: { width: 60 },
  permissionScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionEmoji: { fontSize: 72, marginBottom: 24 },
  permissionTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  permissionBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.textWhite,
  },
  // Web-only styles
  webScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  webEmoji: { fontSize: 72 },
  webTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    color: Colors.text,
    textAlign: 'center',
  },
  webSubtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  scanBadgeWeb: {
    backgroundColor: Colors.accent1 + '33',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  webUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
  },
  webUploadText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 17,
    color: Colors.textWhite,
  },
});
