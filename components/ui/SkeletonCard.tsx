import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';

function SkeletonBox({ width, height, borderRadius = 8, style }: any) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.4, { duration: 700 })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: Colors.border },
        animStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBox width={64} height={64} borderRadius={12} />
      <View style={styles.content}>
        <SkeletonBox width="70%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBox width="40%" height={12} style={{ marginBottom: 8 }} />
        <SkeletonBox width="90%" height={10} />
      </View>
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={styles.dashboard}>
      <SkeletonBox width={200} height={200} borderRadius={100} style={{ alignSelf: 'center', marginBottom: 20 }} />
      <SkeletonBox width="100%" height={16} style={{ marginBottom: 8 }} />
      <SkeletonBox width="60%" height={16} style={{ marginBottom: 24 }} />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  content: { flex: 1 },
  dashboard: { padding: 16 },
});
