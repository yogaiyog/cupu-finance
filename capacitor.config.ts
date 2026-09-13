import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cupufinance.app',
  appName: 'Cupu Finance',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
