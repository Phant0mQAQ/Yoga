# Expo Mobile App

This is the Expo/React Native client for the yoga booking system. It replaces the SwiftUI skeleton for iOS distribution while keeping the existing `/api/v1` backend.

The project is pinned to Expo SDK 54 for Expo client `1017756` compatibility. Keep `expo`, React Native, Expo modules, and Stripe React Native aligned with `npx expo install --check`.

## Run Locally

```powershell
cd C:\Users\23161\Documents\Codex\2026-06-01\files-mentioned-by-the-user-1\outputs\yoga-booking-system\apps\mobile-expo
npm install
npx expo start --lan --clear
```

Expo Go can test normal screens, login, and API flows. It cannot test Apple Pay or native Stripe payment flows.

The API server must also be running from the repository root:

```powershell
node apps/api/server.js
```

For Expo tunnel mode, explicitly provide the computer's current LAN API address:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.43.38:8080/api/v1"
npx expo start --tunnel --clear
```

The iPhone must be able to open `http://192.168.43.38:8080/health` in Safari. If the computer's IPv4 address changes, update `EXPO_PUBLIC_API_BASE_URL`.

Do not run `npm audit fix --force` on this Expo project. The current audit warning is from Expo CLI transitive tooling and npm may propose dependency changes that break Expo SDK alignment. Keep package versions aligned with `npx expo install --check`.

## iOS Development Build

```powershell
npm install -g eas-cli
eas login
eas init
eas build --profile development --platform ios
```

Use this build for Stripe PaymentSheet, Apple Pay, camera scanning, and realistic App Store validation.

## Production Build And Submit

```powershell
eas build --profile production --platform ios
eas submit --platform ios
```

You still need Apple Developer Program membership, App Store Connect app record, production HTTPS API, Stripe live keys, privacy policy, app screenshots, and review accounts.
