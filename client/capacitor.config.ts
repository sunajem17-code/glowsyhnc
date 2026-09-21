import { CapacitorConfig } from '@capacitor/cli';

// Live reload: run `LIVE_RELOAD=1 npx cap sync ios`, then do ONE Xcode
// rebuild+install. From then on the app loads straight from the Vite dev
// server (`npm run dev`, already bound to 0.0.0.0 via vite.config.js) over
// LAN instead of the bundled dist/ — so JS/CSS edits refresh on-device
// instantly, no further Xcode rebuilds needed while iterating.
// LIVE_RELOAD_HOST defaults to this Mac's current LAN IP; override it if
// the network changes (`ipconfig getifaddr en0` to look it up again).
// To go back to a normal build: `npx cap sync ios` with no env var set,
// then one more Xcode rebuild — this must NEVER ship in a real build.
const liveReload = process.env.LIVE_RELOAD === '1'
const liveReloadHost = process.env.LIVE_RELOAD_HOST || '10.0.0.122'

const config: CapacitorConfig = {
  appId: 'com.ascendus.app',
  appName: 'Ascendus',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    ...(liveReload ? { url: `http://${liveReloadHost}:5173`, cleartext: true } : {}),
  },
  ios: {
    backgroundColor: '#00000000', // transparent — allows CameraPreview toBack:true to show through
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#090909',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#090909',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
