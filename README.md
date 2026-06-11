# Yoga Booking System

This repository is a runnable v1 foundation for the planned yoga booking and management system.

It intentionally uses no npm dependencies so it can run in this workspace without package installation. The backend is implemented with built-in Node modules and can persist its complete business state in Supabase Postgres through the Supabase REST API.

## What Is Implemented

- REST API under `/api/v1`
- Email and password login with scrypt password hashes
- Supabase Postgres persistence with optimistic version checks
- In-memory fallback for local development and automated tests
- Role-locked sessions for `student`, `coach`, `staff`, and `admin`
- Student booking flow with capacity checks and membership-card deduction
- Booking cancel, reschedule, and check-in rules
- Member card freeze, extend, transfer, and upgrade operations
- Product/order APIs
- Stripe PaymentIntent and Checkout Session scaffolding
- Stripe webhook signature verification and event handling
- Generic admin CRUD endpoints
- Staff mobile-operation endpoints
- Static web admin UI served by the API at `/admin`
- iPhone/browser PWA preview served by the API at `/app`
- Expo/React Native app scaffold under `apps/mobile-expo` with student, coach, staff, and full mobile admin role screens
- PostgreSQL schema draft in `db/schema.sql`
- Supabase migration in `supabase/migrations`
- OpenAPI outline in `docs/openapi.yaml`
- SwiftUI iOS source skeleton with English, Chinese, and Korean localization files
- Domain tests

## Run

Use the bundled Node runtime or any Node 20+:

```powershell
cd C:\Users\23161\Documents\Codex\2026-06-01\files-mentioned-by-the-user-1\outputs\yoga-booking-system
$env:PORT=8090
node apps/api/server.js
```

Then open:

- API health: `http://localhost:8090/health`
- Admin UI: `http://localhost:8090/admin`
- Mobile PWA preview: `http://localhost:8090/app`

## Supabase

Run the migration in the Supabase SQL editor:

```text
supabase/migrations/202606090001_yomi_app_state.sql
```

Create `.env` from `.env.example`, configure `SUPABASE_URL` and
`SUPABASE_SECRET_KEY`, then start:

```powershell
npm run start:supabase
```

The health endpoint reports `"database": "supabase"` when persistence is
active. See `docs/supabase.md` for details. Never expose the service-role key to
Expo or any client application.

## Test

```powershell
cd C:\Users\23161\Documents\Codex\2026-06-01\files-mentioned-by-the-user-1\outputs\yoga-booking-system
node tests/domain.test.js
node tests/api-routes.test.js
```

## Expo Mobile App

The App Store-oriented mobile client is under:

```text
apps/mobile-expo
```

Install dependencies and start Expo:

```powershell
cd apps/mobile-expo
npm install
npx expo start
```

Build iOS without a local Mac through EAS:

```powershell
eas build --profile development --platform ios
eas build --profile production --platform ios
eas submit --platform ios
```

Expo Go can test basic screens and API calls. Stripe PaymentSheet, Apple Pay, and camera check-in require an EAS Development Build or TestFlight.

## Demo Login

Seed users:

- `student@example.com` with role `student`
- `coach@example.com` with role `coach`
- `staff@example.com` with role `staff`
- `admin@example.com` with role `admin`

Use password `Yomi@2026` for all demo users.

## Stripe Configuration

The Stripe module works in mock mode by default. To call Stripe directly, set:

```text
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=https://your-domain.example
```

The implementation supports:

- `card`
- Apple Pay through `card` wallet capability
- `link`
- `paypal`
- `alipay`
- `wechat_pay`
- `kr_card`
- `kakao_pay`
- `naver_pay`
- `samsung_pay`
- `payco`

Toss Pay is intentionally excluded from Stripe v1 and should be added through the payment-provider abstraction if Antom becomes necessary.

## Production Migration Notes

The current implementation is runnable and testable. Before higher-scale production, continue the second database migration phase:

- Split the compatibility JSONB state into normalized PostgreSQL tables
- Add PostgreSQL transactions and row-level locks for booking and card deduction
- Token signing secret to managed secrets
- Account registration, password reset, and production email delivery
- Redis lock/idempotency persistence for booking and payment flows
- Stripe calls to server-side SDK or hardened HTTP client
- Static admin UI to Next.js
- iOS source skeleton to a full Xcode project with Stripe iOS SDK

## Cloud Release

The checked-in deployment configuration uses:

- Supabase for Postgres persistence
- Render for the Node API
- Vercel for the static admin workspace
- EAS Build and EAS Submit for iOS/TestFlight

Run `npm run preflight` before every release. See
`docs/cloud-deployment.md` for the complete deployment sequence and required
credentials.
