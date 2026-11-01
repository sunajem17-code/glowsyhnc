import { CapacitorConfig } from '@capacitor/cli';

// Live reload: run `LIVE_RELOAD=1 LIVE_RELOAD_HOST=<Mac-Wi-Fi-IP> npx cap sync ios`, then do ONE Xcode
// rebuild+install. From then on the app loads straight from the Vite dev
// server (`npm run dev`, already bound to 0.0.0.0 via vite.config.js) over
// LAN instead of the bundled dist/ — so JS/CSS edits refresh on-device
// instantly, no further Xcode rebuilds needed while iterating.
// Set LIVE_RELOAD_HOST to this Mac's current LAN IP; update it if
// the network changes (`ipconfig getifaddr en0` to look it up again).
// To go back to a normal build: `npx cap sync ios` with no env var set,
// then one more Xcode rebuild — this must NEVER ship in a real build.
const liveReload = process.env.LIVE_RELOAD === '1'
const liveReloadHost = process.env.LIVE_RELOAD_HOST
const liveReloadPort = process.env.LIVE_RELOAD_PORT || '3000'
if (liveReload && !liveReloadHost) throw new Error('LIVE_RELOAD_HOST must be your Mac’s Wi-Fi address')

const config: CapacitorConfig = {
  appId: 'com.ascendus.app',
  appName: 'Ascendus',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    ...(liveReload ? { url: `http://${liveReloadHost}:${liveReloadPort}`, cleartext: true } : {}),
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
