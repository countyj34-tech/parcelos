import type { Config } from "@capacitor/cli";

/**
 * Native shell for App Store / Play Store.
 * Install: npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
 * Then: npx cap init · npm run build · npx cap add ios · npx cap add android · npx cap sync
 */
const config: Config = {
  appId: "africa.parcelos.app",
  appName: "ParcelOS",
  webDir: "dist/client",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0F766E",
    },
  },
};

export default config;
