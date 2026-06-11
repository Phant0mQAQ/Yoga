# Supabase Persistence

The API can persist its complete business state in Supabase Postgres while
keeping the existing domain layer and API contract unchanged.

## 1. Create the database table

Open the Supabase SQL editor and run:

```text
supabase/migrations/202606090001_yomi_app_state.sql
```

The table has Row Level Security enabled and grants no access to `anon` or
`authenticated`. Only the API server uses the service-role key.

## 2. Configure the API

Create `.env` from `.env.example` and set:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_YOUR_SERVER_KEY
```

Never add the secret key to Expo, EAS public environment variables, or
client-side source code.

## 3. Start

```powershell
npm run start:supabase
```

`GET /health` reports `"database": "supabase"` after a successful connection.
With no Supabase variables, the normal `npm start` command uses the in-memory
repository for local development and tests.

## Architecture Note

This is the compatibility phase of the migration. The existing domain store is
saved as a versioned JSONB document, which preserves all current features and
makes data durable immediately. It is intended for one API instance.

The next phase should move high-contention resources such as course sessions,
bookings, member cards, orders, and payments into normalized PostgreSQL tables
with database transactions and row-level locks.
