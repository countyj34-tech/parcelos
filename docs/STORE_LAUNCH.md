# Store & PWA launch (ParcelOS)

ParcelOS ships as **one product** in three shells:

| Surface | How customers get it |
|---|---|
| Web / PWA | HTTPS site → “Install app” / Add to Home Screen |
| Google Play | Capacitor Android (`africa.parcelos.app`) |
| Apple App Store | Capacitor iOS (build on a Mac) |

## Before any store submit

1. Apply Supabase migrations **20–31** (SQL Editor or `supabase db push`).
2. Deploy edge functions + secrets (`GENESYSPAY_WEBHOOK_SECRET`, `CRON_SECRET`, SMS, etc.).
3. Production must use **HTTPS** (PWA + Capacitor `https` scheme).
4. Turn off demo mode in production builds (live Supabase only).
5. Icons: replace SVG placeholders with **1024×1024 PNG** for stores and **192/512 PNG** for the web manifest.

## Build native shells

ParcelOS is an SSR web app — Capacitor does **not** use `dist/client`. It stages `www/` and loads your **live HTTPS URL** in a WebView.

```bash
# Set your live site (Netlify / custom domain)
$env:CAPACITOR_SERVER_URL="https://YOUR-SITE.netlify.app"   # PowerShell
# export CAPACITOR_SERVER_URL=https://YOUR-SITE.netlify.app  # bash

npm run build
npm run cap:sync          # prepares www/ + syncs android/ios
npm run cap:android       # Android Studio → signed AAB
npm run cap:ios           # Xcode on Mac → Archive
```

`webDir` is `www` (stub shell). The real UI comes from `CAPACITOR_SERVER_URL` / `VITE_APP_URL`.

## App identity

- **App ID:** `africa.parcelos.app`
- **Display name:** ParcelOS
- Couriers still brand their **customer portal** (`/c/{slug}`); the store listing is the ParcelOS platform app.

## PWA checklist

- Serve over HTTPS only
- `public/manifest.webmanifest` + icons
- Service worker (`public/sw.js`) registers on customer portal
- Test “Add to Home Screen” on Android Chrome and iOS Safari
