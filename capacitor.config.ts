/**
 * Native shell for App Store / Play Store.
 *
 * This app is SSR (TanStack Start) — there is no static dist/client/index.html.
 * Capacitor loads your live HTTPS site in a WebView (set CAPACITOR_SERVER_URL).
 *
 *   npm run build
 *   npm run prepare:native
 *   npx cap add android   # once
 *   npm run cap:sync
 *   npm run cap:android
 */
const liveUrl = (process.env.CAPACITOR_SERVER_URL || process.env.VITE_APP_URL || "").replace(/\/$/, "");

const config = {
  appId: "africa.parcelos.app",
  appName: "ParcelOS",
  webDir: "www",
  backgroundColor: "#0F766E",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    ...(liveUrl
      ? {
          url: liveUrl,
          cleartext: liveUrl.startsWith("http://"),
        }
      : {}),
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: "#0F766E",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0F766E",
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0F766E",
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#0F766E",
  },
};

if (!liveUrl) {
  console.warn(
    "[capacitor] CAPACITOR_SERVER_URL (or VITE_APP_URL) is unset — set it to your HTTPS Netlify URL so the app loads the real site.",
  );
}

export default config;
