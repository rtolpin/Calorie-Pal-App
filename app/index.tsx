import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function RootIndex() {
  const { session, isGuest, initialized } = useAuthStore();

  if (!initialized) return null;

  if (session || isGuest) {
    return <Redirect href="/(tabs)/" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
