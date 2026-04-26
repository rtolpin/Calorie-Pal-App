import { Platform } from 'react-native';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// URL polyfill is only needed in React Native, not on web
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// On web, Supabase defaults to localStorage; on native, use AsyncStorage
const getAuthStorage = () => {
  if (Platform.OS === 'web') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@react-native-async-storage/async-storage').default;
};

// Cache the client in globalThis so Expo's hot-module replacement never
// creates a second instance. Two clients sharing the same lock name compete
// for the Web Locks API lock and one steals it, causing:
// "Lock was released because another request stole it"
declare global {
  // eslint-disable-next-line no-var
  var _supabaseClient: SupabaseClient | undefined;
}

export const supabase: SupabaseClient =
  globalThis._supabaseClient ??
  (globalThis._supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: getAuthStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }));
