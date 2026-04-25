// Polyfill Expo globals that are normally installed by the native runtime
if (typeof global.__ExpoImportMetaRegistry === 'undefined') {
  global.__ExpoImportMetaRegistry = {};
}
