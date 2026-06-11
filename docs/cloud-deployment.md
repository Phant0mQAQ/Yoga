# Yomi Yoga Cloud Deployment

The production topology is:

```text
iOS / Vercel Admin
        |
        v
Render Node API
        |
        +-- Supabase Postgres
        +-- Stripe
```

Supabase is the database, not the public application API. Never put
`SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, or `APP_SECRET` in Expo, Vercel
client JavaScript, or Git.

## 1. Release validation

From the repository root:

```powershell
npm test
npm run preflight

cd apps/mobile-expo
npx tsc --noEmit
npx expo-doctor
npx expo export --platform ios --output-dir dist-ios-check
cd ../..
```

`npm run preflight:cloud` additionally checks local production variables. It
is expected to fail until the real cloud URLs and secrets are available.

## 2. Push the Supabase migration

Install or invoke the CLI, authenticate, link the project, and push:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For a URL such as `https://abc123.supabase.co`, the project ref is `abc123`.
`supabase login` needs a Supabase personal access token, not an anon key or
service-role key.

After the push, verify in the Supabase table editor that
`public.yomi_app_state` exists and has Row Level Security enabled.

## 3. Publish the repository

Create an empty private GitHub repository, then run:

```powershell
git init
git add .
git commit -m "Prepare Yomi Yoga cloud release"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

Confirm `.env`, `node_modules`, Expo cache directories, logs, and generated
release exports are not included in the commit.

## 4. Deploy the API on Render

The repository includes `render.yaml`. In Render:

1. Choose **New > Blueprint**.
2. Connect the GitHub repository.
3. Select `render.yaml`.
4. Keep one API instance. The current JSONB compatibility repository is
   intentionally single-instance.
5. Enter every variable marked `sync: false`.

Required Render variables:

```text
APP_BASE_URL=https://YOUR_RENDER_SERVICE.onrender.com
APP_SECRET=<at least 32 random characters>
CORS_ALLOWED_ORIGINS=https://YOUR_VERCEL_DOMAIN
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=<Supabase server secret>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MERCHANT_IDENTIFIER=merchant.com.yomiyoga.studio
INITIAL_ADMIN_EMAIL=<private administrator email>
INITIAL_ADMIN_PASSWORD=<unique password, at least 12 characters>
```

The first production startup removes the known demo login identities and
creates the configured administrator login. The service intentionally refuses
to start if required production secrets are missing.

Verify:

```text
https://YOUR_RENDER_SERVICE.onrender.com/health
```

The response must report:

```json
{
  "ok": true,
  "database": "supabase"
}
```

## 5. Configure Stripe

In Stripe Workbench, create a webhook endpoint:

```text
https://YOUR_RENDER_SERVICE.onrender.com/api/v1/payments/stripe/webhook
```

Subscribe to:

```text
payment_intent.succeeded
payment_intent.payment_failed
checkout.session.completed
charge.refunded
refund.updated
```

Copy the endpoint signing secret to Render as `STRIPE_WEBHOOK_SECRET`, then
redeploy. Complete end-to-end payments in Stripe test mode before replacing
test keys with live keys.

## 6. Deploy the admin site on Vercel

The current admin is a static application, not Next.js. In Vercel:

1. Import the GitHub repository.
2. Set **Root Directory** to `apps/admin`.
3. Keep the build command `npm run build`.
4. Keep the output directory `dist`.
5. Add:

```text
YOMI_API_BASE_URL=https://YOUR_RENDER_SERVICE.onrender.com/api/v1
```

6. Deploy.
7. Put the final Vercel origin in Render's `CORS_ALLOWED_ORIGINS`, then
   redeploy the API.

Open the Vercel URL and sign in with `INITIAL_ADMIN_EMAIL` and
`INITIAL_ADMIN_PASSWORD`.

## 7. Configure EAS

From `apps/mobile-expo`:

```powershell
npx eas-cli login
npx eas-cli init
npx eas-cli env:create --environment production --name EXPO_PUBLIC_API_BASE_URL --value https://YOUR_RENDER_SERVICE.onrender.com/api/v1 --visibility plaintext
```

`EXPO_PUBLIC_API_BASE_URL` is intentionally public and contains no secret.
Keep all Supabase and Stripe server keys on Render.

The configured iOS identifiers are:

```text
Bundle ID: com.yomiyoga.studio
Apple Pay merchant ID: merchant.com.yomiyoga.studio
```

If either identifier is already owned by another Apple account, change both
before the first EAS production build.

## 8. Build and distribute through TestFlight

Requirements:

- Active Apple Developer Program membership.
- App Store Connect app record using the same bundle ID.
- App privacy answers and privacy-policy URL.
- Review credentials for student, coach, staff, and admin roles.

Build:

```powershell
npx eas-cli build --platform ios --profile production
```

Submit the completed build:

```powershell
npx eas-cli submit --platform ios --profile production
```

In App Store Connect:

1. Wait for processing to finish.
2. Add the build to an internal TestFlight group.
3. Test login, logout, all four roles, booking, participant avatars,
   cancellation, check-in, admin CRUD, refunds, languages, dark mode, and
   Stripe test payments.
4. Add external testers only after internal validation passes.
5. Complete screenshots, description, support URL, privacy labels, review
   notes, and submit for App Review.

## 9. Release acceptance checks

- `/health` reports `database: supabase`.
- Demo credentials do not work against production.
- The Vercel admin can call the Render API without CORS errors.
- The iOS production build uses an HTTPS API URL.
- Stripe webhook events are accepted exactly once.
- A booking persists after an API restart.
- Logout immediately returns to the login screen and protected calls return
  `401`.
- No server secret appears in the Expo bundle or browser source.
