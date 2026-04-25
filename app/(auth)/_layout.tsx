import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="create-account" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-otp" />
    </Stack>
  );
}
