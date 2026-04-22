import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = Haptics.NotificationFeedbackType;

export function impactAsync(style: Haptics.ImpactFeedbackStyle): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.impactAsync(style);
}

export function notificationAsync(type: Haptics.NotificationFeedbackType): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.notificationAsync(type);
}
