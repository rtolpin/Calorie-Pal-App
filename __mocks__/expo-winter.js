// Empty mock — prevents expo/src/winter/runtime.native from installing
// polyfills that use ESM-only packages (@ungap/structured-clone) in Jest.
// Node.js 17+ already provides structuredClone, URL, etc. natively.
