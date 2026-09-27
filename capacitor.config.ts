import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.freeform.notes',
  appName: 'Free Form',
  webDir: 'client/dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_alarm',
      iconColor: '#306ECE',
      sound: 'alarm_chime.wav'
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#161A25',
      showSpinner: false,
      androidSplashResourceName: 'splash'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#161A25'
    }
  }
};

export default config;
