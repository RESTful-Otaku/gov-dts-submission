import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uk.gov.caseworker.taskmanager',
  appName: 'DTS Caseworker Task Manager',
  webDir: 'dist',
  server: {
    cleartext: true, // allow HTTP to 10.0.2.2 (emulator host) for local dev
  },
  android: {
    allowMixedContent: true, // allow HTTP API requests from capacitor:// page
  },
  // @capacitor-community/sqlite defaults androidIsEncryption to true and builds MasterKey +
  // EncryptedSharedPreferences on load(). That fails on many devices (null getMessage() →
  // "CapacitorSQLitePlugin: null"). We use no-encryption DB mode in JS; disable native encryption.
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
}

export default config

