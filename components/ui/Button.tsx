import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '../../lib/haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  gradient?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  gradient = false,
  icon,
  onPress,
  style,
  ...props
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 20, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };

  const handlePress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const buttonStyle = [
    styles.base,
    styles[size],
    !gradient && styles[variant],
    props.disabled && styles.disabled,
    style,
  ];

  const textStyle = [styles.text, styles[`text_${size}`], styles[`text_${variant}`]];

  const content = (
    <View style={styles.inner}>
      {icon && <View style={styles.icon}>{icon}</View>}
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.textWhite}
          size="small"
        />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </View>
  );

  return (
    <AnimatedTouchable
      style={[animatedStyle, buttonStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      {...props}
    >
      {gradient ? (
        <LinearGradient
          colors={Colors.gradientOrangeYellow}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, styles[size]]}
        >
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sizes
  sm: { paddingVertical: 10, paddingHorizontal: 16 },
  md: { paddingVertical: 14, paddingHorizontal: 24 },
  lg: { paddingVertical: 18, paddingHorizontal: 32 },
  // Variants
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.secondary },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: Colors.error },
  disabled: { opacity: 0.5 },
  // Text
  text: { fontFamily: 'Nunito_700Bold', textAlign: 'center' },
  text_sm: { fontSize: 14 },
  text_md: { fontSize: 16 },
  text_lg: { fontSize: 18 },
  text_primary: { color: Colors.textWhite },
  text_secondary: { color: Colors.textWhite },
  text_outline: { color: Colors.primary },
  text_ghost: { color: Colors.primary },
  text_danger: { color: Colors.textWhite },
});
