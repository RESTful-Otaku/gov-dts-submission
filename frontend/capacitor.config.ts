import type { CapacitorConfig } from '@capacitor/cli'

const isProd = process.env.NODE_ENV === 'production'
const allowCleartext = process.env.CAPACITOR_ALLOW_CLEARTEXT === 'true' || (!isProd && process.env.CAPACITOR_ALLOW_CLEARTEXT !== 'false')
const allowMixedContent =
  process.env.CAPACITOR_ALLOW_MIXED_CONTENT === 'true' || (!isProd && process.env.CAPACITOR_ALLOW_MIXED_CONTENT !== 'false')

const config: CapacitorConfig = {
  appId: 'uk.gov.caseworker.taskmanager',
  appName: 'DTS Caseworker Task Manager',
  webDir: 'dist',
  server: {
    cleartext: allowCleartext,
  },
  android: {
    allowMixedContent,
  },
  // Enable SQLCipher-backed encryption for mobile SQLite.
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: true,
    },
  },
}

export default config

