# California production checklist

The application now defaults to the United States, US dollars, and the `America/Los_Angeles` timezone. Render is configured for Oregon and production mode.

Before deployment, configure these Render environment variables with real business details:

- `APP_BASE_URL=https://YOUR_API_HOST` (use the final Render or custom API domain)
- `LEGAL_OPERATOR_NAME` — exact legal entity operating the studio
- `LEGAL_POSTAL_ADDRESS` — complete business mailing address
- `PRIVACY_EMAIL` and `SUPPORT_EMAIL` — monitored addresses on the studio domain
- `INITIAL_ADMIN_EMAIL` and a unique 12+ character `INITIAL_ADMIN_PASSWORD`
- Supabase and Stripe secrets listed in `.env.example`

Operational launch checks:

- Use a Supabase project in US West. Moving an existing project requires a planned data migration and maintenance window.
- Configure Stripe for a US business account, USD settlement, cards, PayPal (if enabled on the account), Apple Pay, and Google Pay.
- Replace the legal-page contact values with counsel-approved content. The built-in pages are a functional baseline, not legal advice.
- Review the membership agreement and cancellation/refund rules with California counsel before selling passes.
- Complete App Store privacy answers from the actual production data flows and keep in-app account deletion enabled.
- Verify `/privacy`, `/privacy-choices`, `/terms`, Stripe webhooks, account deletion, data requests, and membership cancellation in production.

Required public URLs:

- `https://YOUR_API_HOST/privacy`
- `https://YOUR_API_HOST/privacy-choices`
- `https://YOUR_API_HOST/terms`
