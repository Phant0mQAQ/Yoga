# Good Vibe Pilates & Yoga — Alibaba Cloud US West Deployment

This is the production runbook for migrating the API, database, uploads, and static admin site from Render/Supabase/Vercel to Alibaba Cloud.

## 1. Target architecture

Use Alibaba Cloud **US (Silicon Valley) / US West 1**, Region ID `us-west-1`.

```text
iOS / browser
      |
      +-- api.example.com ------ ALB HTTPS ------ ECS Docker API :8080
      |                                              |
      |                                              +-- RDS PostgreSQL (private VPC)
      |                                              +-- OSS signed PUT URLs
      |                                              +-- Stripe API/webhook
      |
      +-- admin.example.com ---- CDN ----------- private OSS static bucket
      +-- assets.example.com --- CDN ----------- private OSS media bucket
```

Keep all resources in `us-west-1` and the same VPC. The OSS SDK region value is `oss-us-west-1` and the public endpoint is `oss-us-west-1.aliyuncs.com`.

The current JSONB state is safe for a single API process. Run one ECS API container. Multiple API replicas require a later normalized-table/transaction migration because each process keeps an in-memory state copy.

## 2. Create the network and security boundary

1. Create a VPC such as `10.20.0.0/16` in `us-west-1`.
2. Create vSwitches in the available Silicon Valley zones. Put RDS and ECS on private-address connectivity.
3. Create an internet-facing Application Load Balancer with HTTPS listener `443`.
4. Add an ALB server group that forwards to ECS port `8080` and checks `/health`.
5. ECS security group: allow `8080` only from the ALB/security-group path; allow SSH only from a trusted administrator IP or use Cloud Assistant instead.
6. RDS whitelist/security rules: allow only the ECS VPC CIDR or ECS security group. Do not expose PostgreSQL `5432` to `0.0.0.0/0`.

Recommended starting size is one ECS instance with at least 2 vCPU/4 GiB RAM and an RDS PostgreSQL high-availability instance sized for the expected workload. Enable automatic RDS backups and deletion protection before cutover.

## 3. Create RDS PostgreSQL

1. Create ApsaraDB RDS for PostgreSQL in `us-west-1`, in the same VPC as ECS.
2. Create database `good_vibe` and a least-privilege application account such as `good_vibe_app`.
3. Enable SSL and download the RDS CA certificate.
4. Base64-encode the complete CA PEM and set it as `DATABASE_SSL_CA_BASE64`.
5. Execute `db/alibaba-rds.sql` in DMS or with `psql`.

The API uses compare-and-swap on the `version` column. `/health` must report `"database":"postgres"` after deployment.

## 4. Create OSS buckets and CDN domains

Create two buckets in `us-west-1`:

- `good-vibe-media-us-west-1`: uploaded coach, content, and product images.
- `good-vibe-admin-us-west-1`: static admin application.

Recommended configuration:

- Keep the buckets private and let CDN access the OSS origins with origin authorization.
- Bind `assets.example.com` to the media bucket and `admin.example.com` to the admin bucket.
- Enable HTTPS certificates on both CDN domains.
- Select **Global (Excluding the Chinese Mainland)** if the product serves overseas users and does not have an ICP filing.
- Configure media-bucket CORS to allow `PUT` from the exact admin domain and required mobile origins. Allow the `Content-Type` header; do not use `*` in production.
- Set the admin bucket index document to `index.html`.

The API signs short-lived direct `PUT` URLs. Never place the OSS AccessKey secret in the mobile app or browser JavaScript.

Create a dedicated RAM user or RAM role restricted to the media/admin buckets. Rotate any migration credentials after cutover.

## 5. Configure the production environment

Copy the template and fill real values without committing it:

```powershell
Copy-Item .env.alibaba.example .env.alibaba
```

Important values:

```text
CLOUD_PROVIDER=alibaba
NODE_ENV=production
APP_BASE_URL=https://api.example.com
CORS_ALLOWED_ORIGINS=https://admin.example.com
DATABASE_URL=postgresql://...
DATABASE_SSL_MODE=verify-full
OSS_REGION=oss-us-west-1
OSS_PUBLIC_BASE_URL=https://assets.example.com
GOOD_VIBE_API_BASE_URL=https://api.example.com/api/v1
EXPO_PUBLIC_API_BASE_URL=https://api.example.com/api/v1
```

Run:

```powershell
npm ci
npm test
npm run preflight
npm run preflight:alibaba
```

The Alibaba preflight rejects placeholders, non-HTTPS public URLs, the wrong OSS region, missing Stripe secrets, and an insecure production database profile.

## 6. Migrate existing Supabase data

Create an RDS snapshot/backup before every re-run. The source credentials are used only during migration.

First inspect the source without writing:

```powershell
npm run migrate:alibaba:assets -- --dry-run
npm run migrate:alibaba:state -- --dry-run
```

For a short maintenance-window migration:

1. Disable booking/admin mutations on the old service or announce maintenance.
2. Migrate storage objects first:

   ```powershell
   npm run migrate:alibaba:assets
   ```

3. Migrate the JSONB application state:

   ```powershell
   npm run migrate:alibaba:state
   ```

The state migration rewrites URLs under the configured Supabase public bucket to `OSS_PUBLIC_BASE_URL`. It refuses to overwrite an existing RDS primary row. `--force` is available only for an intentional, backed-up retry.

4. Compare collection counts printed by the migration with the source.
5. Start the Alibaba API and run read-only smoke checks before changing DNS.

For a large or continuously changing PostgreSQL database, use Alibaba Cloud DTS full plus incremental migration. This application currently stores one JSONB state row, so the checked-in maintenance-window scripts are simpler and easier to verify.

## 7. Build and publish the API container

ACR Personal Edition no longer performs source-code image builds in US Silicon Valley. Build locally or in CI, then push the finished image to ACR. ACR Enterprise Edition is supported in `us-west-1`.

Example:

```powershell
docker build -t good-vibe-api:1.0.0 .
docker tag good-vibe-api:1.0.0 registry.us-west-1.aliyuncs.com/YOUR_NAMESPACE/good-vibe-api:1.0.0
docker login registry.us-west-1.aliyuncs.com
docker push registry.us-west-1.aliyuncs.com/YOUR_NAMESPACE/good-vibe-api:1.0.0
```

Copy `deploy/alibaba/ecs-compose.yml` and the secret `.env.alibaba` to a protected directory on ECS. Then:

```bash
export API_IMAGE=registry.us-west-1.aliyuncs.com/YOUR_NAMESPACE/good-vibe-api:1.0.0
docker compose -f ecs-compose.yml pull
docker compose -f ecs-compose.yml up -d
docker compose -f ecs-compose.yml ps
```

Do not expose `.env.alibaba` through a web directory. Prefer Alibaba Cloud KMS/Secrets Manager or ECS RAM roles when operational access is available.

Verify through ALB:

```text
https://api.example.com/health
https://api.example.com/api/v1/home?locale=en
```

## 8. Publish the static admin site

After DNS/CDN and the admin OSS bucket exist:

```powershell
npm run deploy:admin:oss
```

The script builds `apps/admin/dist`, embeds `GOOD_VIBE_API_BASE_URL`, assigns safe content types/cache headers, and uploads the result to `OSS_ADMIN_BUCKET`. It does not delete unrelated bucket objects.

Open `https://admin.example.com`, sign in, upload an image, and verify the returned URL starts with `https://assets.example.com/`.

## 9. Switch Stripe and EAS

Create or update the Stripe webhook endpoint:

```text
https://api.example.com/api/v1/payments/stripe/webhook
```

Copy its live `whsec_...` value to the ECS environment and restart the container. Keep the old webhook active during the validation window, but ensure only the active production API can fulfill live orders.

Update EAS production variables from `apps/mobile-expo`:

```powershell
npx eas-cli@latest env:update --environment production --name EXPO_PUBLIC_API_BASE_URL --value https://api.example.com/api/v1 --visibility plaintext
npx eas-cli@latest env:list --environment production
```

Because `EXPO_PUBLIC_*` values are compiled into the binary, create a new production EAS build and validate it in TestFlight after the API cutover.

## 10. Cutover checklist

- `/health` returns `ok:true` and `database:postgres` through ALB HTTPS.
- RDS is private, backed up, SSL-enabled, and not open to the internet.
- Admin CORS allows only the production admin origin.
- OSS signed upload, CDN read, MIME type, and cache behavior work.
- Student/Coach/Staff/Admin login and authorization work.
- Booking, cancellation, reschedule, card credits, check-in, orders, payment, and refund work.
- Stripe test event and one controlled live payment/refund reach the new webhook exactly once.
- An API container restart preserves all data.
- EAS production build contains `https://api.example.com/api/v1` and no server secrets.
- CloudMonitor alerts cover ALB 5xx, ECS CPU/disk, container health, RDS connections/storage, and OSS/CDN traffic anomalies.

Lower DNS TTL before cutover. Keep Render, Supabase, and Vercel read-only for at least 48 hours. After validation, revoke old service keys and disable old writes before deleting any resource.

## 11. Rollback

If validation fails:

1. Stop writes to the Alibaba API.
2. Restore DNS/EAS routing to the previous API and admin origins.
3. Re-enable the previous Stripe webhook as the sole fulfillment endpoint.
4. Export the Alibaba RDS state generated after cutover and reconcile it before accepting new writes on the old platform.
5. Preserve RDS/OSS snapshots and logs for diagnosis; do not delete the failed deployment immediately.

Rollback is straightforward only while writes are frozen or reconciled. Never allow both old and new APIs to accept mutations independently.
