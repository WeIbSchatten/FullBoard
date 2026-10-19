# We1ssBoard mobile

Expo (React Native) app to manage a We1ssBoard panel from the phone: server overview,
clients (search, enable/disable, reset traffic, subscription and share links with QR,
create, delete), inbounds, nodes, Telegram WEB Proxy status, and Xray / panel restarts.

## Connect

The app talks to the panel API with an **admin API token**, never the panel password:

1. In the panel open Settings → Security → API tokens and create a token with the
   `admin` scope.
2. In the app enter the panel address exactly as in the browser, including the
   secret web base path (for example `panel.example.com:2053/abc`), and the token.

The token is kept in the OS keystore (`expo-secure-store`). Prefer HTTPS: over plain
HTTP (a panel without a certificate, which the Android app allows) the token travels
unencrypted.

## Install on Android

Every panel release carries `we1ssboard-android-<version>.apk`, built and signed by
`.github/workflows/mobile-release.yml`. Download it on the phone and install it; later
releases install over it and keep the sign-in.

## Develop

```bash
cd mobile
npm install
npx expo start          # scan the QR code with Expo Go
npx tsc --noEmit        # typecheck
npx expo lint
npx jest
```

API types come straight from the panel's generated `frontend/src/generated/types.ts`
(`@panel/types`), so a Go struct change shows up here as a type error.

## Build

Builds run on EAS, no Xcode or Android Studio needed:

```bash
npx eas-cli@latest build --platform android --profile preview   # installable APK
npx eas-cli@latest build --platform ios
```

Icons and the splash are rendered from `media/brand` by `frontend/scripts/render-brand.mjs`.
