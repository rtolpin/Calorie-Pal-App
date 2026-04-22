import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// expo-notifications is not supported on web
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(timeString: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelDailyReminder();
  const [hours, minutes] = timeString.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'CaloriePal 🍎',
      body: "Don't forget to log your meals today!",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
