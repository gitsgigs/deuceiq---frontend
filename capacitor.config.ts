import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deuceiq.app',
  appName: 'DeuceIQ',
  webDir: 'dist',
  server: { hostname: 'localhost', androidScheme: 'https' },
  ios: { contentInset: 'automatic' },
};
export default config;
