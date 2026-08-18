# Cloudflare Deployment

The Cloudflare staging topology is:

```text
Workers static assets (/admin and /app)
              |
              v
Node.js HTTP compatibility handler (/api/v1)
              |
              v
Cloudflare D1 (good-vibe-pilates-yoga)
```

## Deploy

Authenticate Wrangler, then run:

```powershell
npm install
npm test
npm run deploy:cloudflare
```

Wrangler runs `npm run build:cloudflare` through the checked-in `build.command`
before local deployments and Cloudflare Git preview/production uploads. Keep the
Cloudflare dashboard build command empty so the same repository-owned build step
is used everywhere.

The public URL is `https://good-vibe-pilates-yoga.2316196563.workers.dev`.

`APP_SECRET` and `FIREBASE_WEB_API_KEY` are stored as encrypted Worker Secrets and must never be added to `wrangler.jsonc`. The staging deployment uses Firebase Authentication with D1 business records and mock Stripe responses. Do not load real customer data into it.

Keep `AUTH_PROVIDER` set to `firebase`. New registrations and identities without a local password use Firebase, which provides the verification email required by student and invited-coach registration. Existing seeded or migrated identities that still have a local password hash remain able to sign in during the transition. Switching this database back to `local` makes Firebase-only accounts impossible to authenticate and disables registration unless a separate email provider is configured.

## Firebase Authentication

1. Create or select a Firebase project and add a Web app.
2. In **Authentication > Sign-in method**, enable **Email/Password**.
3. Copy the Firebase Web API key, then store it for the Worker:

```powershell
npm exec --yes --package=wrangler@latest -- wrangler secret put FIREBASE_WEB_API_KEY
```

4. Create and verify the required seeded coach and administrator users, confirm `AUTH_PROVIDER` is `firebase` in `wrangler.jsonc`, then build and deploy.
5. In Firebase Authentication, create every existing coach and administrator with the same email used in D1. After they verify the Firebase email and sign in, the API links the Firebase UID to the existing D1 user and removes the legacy password hash.

Firebase sends and hosts the verification link, so this flow does not require Resend, Bizcn access, or a custom sending domain. iOS, the Expo Web build, `/app`, and `/admin` continue to use the same `/api/v1` backend and D1 business records.

## Production promotion

Before treating this deployment as production:

1. Replace the seed accounts with a unique administrator identity.
2. Configure real Stripe secrets and the webhook endpoint.
3. Replace placeholder legal contact details.
4. Configure durable media storage with R2 or Supabase Storage.
5. Set a custom domain and restrict CORS to the final web origins.
6. Run the full release and payment acceptance checks.
