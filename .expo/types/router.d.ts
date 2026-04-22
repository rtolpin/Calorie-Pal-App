/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)` | `/(auth)/create-account` | `/(auth)/onboarding` | `/(auth)/sign-in` | `/(auth)/welcome` | `/(tabs)` | `/(tabs)/` | `/(tabs)/insights` | `/(tabs)/journal` | `/(tabs)/profile` | `/(tabs)/snap` | `/_sitemap` | `/create-account` | `/insights` | `/journal` | `/log-exercise` | `/onboarding` | `/profile` | `/sign-in` | `/snap` | `/snap-result` | `/welcome`;
      DynamicRoutes: `/edit-entry/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/edit-entry/[id]`;
    }
  }
}
