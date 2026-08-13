# Expo Mobile App

This is the Expo/React Native client for Good Vibe Pilates & Yoga. It replaces the SwiftUI skeleton for iOS distribution while keeping the existing `/api/v1` backend.

The project is pinned to Expo SDK 54 for Expo client `1017756` compatibility. Keep `expo`, React Native, Expo modules, and Stripe React Native aligned with `npx expo install --check`.

## Run Locally

```powershell
cd C:\Users\23161\Documents\Codex\2026-06-01\files-mentioned-by-the-user-1\outputs\yoga-booking-system\apps\mobile-expo
npm install
npx expo start --lan --clear
```

Expo Go can test normal screens, login, and API flows. It cannot test Apple Pay or native Stripe payment flows.

The iOS authentication screen supports verified-email login, public student registration, and invitation-only coach registration. Firebase Authentication owns passwords and sends a hosted verification link; the account cannot sign in until that link is opened. The role switcher is shown only before authentication and offers student, coach, and administrator workspaces; a successful session locks the selected role until logout. The single fixed administrator account is sign-in only and cannot be self-registered.

Both iOS and Web use the same `EXPO_PUBLIC_API_BASE_URL`/`/api/v1` service and persistent application state. Verified iOS registrations therefore appear in the Web administrator member list.

For Cloudflare production, enable **Email/Password** in Firebase Authentication and store the Firebase Web API key in the Worker configuration:

```powershell
npx wrangler secret put FIREBASE_WEB_API_KEY
npx wrangler secret put COACH_INVITE_CODE
```

Set `AUTH_PROVIDER=firebase` on the API service. The iOS/Web clients continue to call the shared Good Vibe API, so no Firebase secret or service-account credential belongs in an `EXPO_PUBLIC_*` variable. Firebase Web API keys identify a Firebase project and are public by design, but they should still be restricted to Firebase Authentication APIs and the expected app clients.

Existing D1 coach/admin/member records are linked by matching their verified Firebase email on first successful sign-in. Create those Firebase Authentication users with the same email before enabling Firebase in production; their old D1 password hash is removed after the first Firebase login.

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
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_BASE_URL --value https://good-vibe-pilates-yoga.2316196563.workers.dev/api/v1 --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_REPLACE_WITH_CLIENT_KEY --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER --value merchant.com.goodvibe.pilatesyoga --visibility plaintext
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --profile production --platform ios
```

`EXPO_PUBLIC_*` values are compiled into the app and must never contain server secrets. The Stripe publishable key is public; the Stripe secret key remains on the API server.

You still need Apple Developer Program membership, an App Store Connect app record, a production HTTPS API, Stripe live configuration, a public privacy policy, current iPhone screenshots, and private review accounts. See `../../docs/app-store-handoff/00-CLIENT-START-HERE.zh-CN.md`.
