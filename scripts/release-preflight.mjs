import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const notices = [];

const appJson = readJson("apps/mobile-expo/app.json");
const easJson = readJson("apps/mobile-expo/eas.json");
const mobilePackage = readJson("apps/mobile-expo/package.json");
const renderYaml = readText("render.yaml");
const adminVercel = readJson("apps/admin/vercel.json");

check(mobilePackage.dependencies?.expo?.startsWith("~54."), "Expo must remain on SDK 54.");
check(appJson.expo?.name === "Good Vibe Pilates & Yoga", "Unexpected Expo display name.");
check(appJson.expo?.icon === "./assets/good-vibe-icon.png", "Unexpected Expo app icon.");
check(appJson.expo?.splash?.image === "./assets/good-vibe-logo.png", "Unexpected Expo splash logo.");
check(
  appJson.expo?.android?.adaptiveIcon?.foregroundImage === "./assets/good-vibe-adaptive-icon.png",
  "Unexpected Android adaptive icon."
);
for (const asset of [
  "apps/mobile-expo/assets/good-vibe-logo.png",
  "apps/mobile-expo/assets/good-vibe-icon.png",
  "apps/mobile-expo/assets/good-vibe-adaptive-icon.png"
]) {
  check(fs.existsSync(path.join(root, asset)), `Missing brand asset: ${asset}`);
}
check(appJson.expo?.slug === "good-vibe-pilates-yoga", "Unexpected Expo slug.");
check(appJson.expo?.scheme === "goodvibe", "Unexpected app URL scheme.");
check(appJson.expo?.ios?.bundleIdentifier === "com.goodvibe.pilatesyoga", "Unexpected iOS bundle identifier.");
check(
  appJson.expo?.plugins?.some(
    (plugin) => Array.isArray(plugin)
      && plugin[0] === "@stripe/stripe-react-native"
      && plugin[1]?.merchantIdentifier === "merchant.com.goodvibe.pilatesyoga"
  ),
  "Stripe merchant identifier does not match the iOS bundle."
);
check(!JSON.stringify(appJson).includes("replace-with"), "app.json still contains a deployment placeholder.");
check(!JSON.stringify(easJson).includes("replace-with"), "eas.json still contains a deployment placeholder.");
check(adminVercel.outputDirectory === "dist", "Vercel admin output directory must be dist.");
check(renderYaml.includes("healthCheckPath: /health"), "Render health check is not configured.");
check(fs.existsSync(path.join(root, "supabase/config.toml")), "Supabase CLI configuration is missing.");
check(
  fs.readdirSync(path.join(root, "supabase/migrations")).some((name) => name.endsWith(".sql")),
  "No Supabase migration was found."
);
for (const artifact of [
  "Dockerfile",
  "deploy/alibaba/ecs-compose.yml",
  "db/alibaba-rds.sql",
  "scripts/migrate-supabase-to-rds.mjs",
  "scripts/migrate-supabase-storage-to-oss.mjs",
  "scripts/deploy-admin-oss.mjs"
]) {
  check(fs.existsSync(path.join(root, artifact)), `Missing Alibaba Cloud deployment artifact: ${artifact}`);
}

if (process.argv.includes("--cloud")) {
  const env = { ...readEnvFile(".env"), ...process.env };
  requireUrl(env.SUPABASE_URL, "SUPABASE_URL", ".supabase.co");
  requireSecret(env.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY");
  requireUrl(env.APP_BASE_URL, "APP_BASE_URL");
  requireSecret(env.APP_SECRET, "APP_SECRET", 32);
  requireSecret(env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");
  requireSecret(env.STRIPE_PUBLISHABLE_KEY, "STRIPE_PUBLISHABLE_KEY");
  requireSecret(env.STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET");
  requireSecret(env.INITIAL_ADMIN_EMAIL, "INITIAL_ADMIN_EMAIL");
  requireSecret(env.INITIAL_ADMIN_PASSWORD, "INITIAL_ADMIN_PASSWORD", 12);
  check(env.AUTH_PROVIDER === "firebase", "AUTH_PROVIDER must be firebase.");
  requireSecret(env.FIREBASE_WEB_API_KEY, "FIREBASE_WEB_API_KEY");
  requireSecret(env.COACH_INVITE_CODE, "COACH_INVITE_CODE", 12);
  requireSecret(env.EXPO_PUBLIC_API_BASE_URL, "EXPO_PUBLIC_API_BASE_URL");
  requireSecret(env.GOOD_VIBE_API_BASE_URL, "GOOD_VIBE_API_BASE_URL");
  if (!env.SUPABASE_ACCESS_TOKEN) {
    notices.push("SUPABASE_ACCESS_TOKEN is not set; interactive `supabase login` is required.");
  }
  if (!env.EXPO_TOKEN) {
    notices.push("EXPO_TOKEN is not set; interactive `eas login` is required.");
  }
}

if (process.argv.includes("--alibaba")) {
  const env = { ...readEnvFile(".env.alibaba"), ...process.env };
  check(env.CLOUD_PROVIDER === "alibaba", "CLOUD_PROVIDER must be alibaba.");
  check(env.NODE_ENV === "production", "NODE_ENV must be production for Alibaba Cloud release.");
  requireUrl(env.APP_BASE_URL, "APP_BASE_URL");
  requireUrl(env.CORS_ALLOWED_ORIGINS?.split(",")[0], "CORS_ALLOWED_ORIGINS");
  requireSecret(env.APP_SECRET, "APP_SECRET", 32);
  requirePostgresUrl(env.DATABASE_URL, "DATABASE_URL");
  check(
    ["require", "verify-full"].includes(String(env.DATABASE_SSL_MODE).toLowerCase()),
    "DATABASE_SSL_MODE must be require or verify-full for Alibaba Cloud production."
  );
  if (String(env.DATABASE_SSL_MODE).toLowerCase() === "verify-full") {
    requireSecret(env.DATABASE_SSL_CA_BASE64, "DATABASE_SSL_CA_BASE64", 32);
  }
  check(env.OSS_REGION === "oss-us-west-1", "OSS_REGION must be oss-us-west-1 for US West 1.");
  requireSecret(env.OSS_ACCESS_KEY_ID, "OSS_ACCESS_KEY_ID");
  requireSecret(env.OSS_ACCESS_KEY_SECRET, "OSS_ACCESS_KEY_SECRET");
  requireSecret(env.OSS_BUCKET, "OSS_BUCKET");
  requireUrl(env.OSS_PUBLIC_BASE_URL, "OSS_PUBLIC_BASE_URL");
  check(env.OSS_ADMIN_REGION === "oss-us-west-1", "OSS_ADMIN_REGION must be oss-us-west-1.");
  requireSecret(env.OSS_ADMIN_BUCKET, "OSS_ADMIN_BUCKET");
  requireSecret(env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");
  requireSecret(env.STRIPE_PUBLISHABLE_KEY, "STRIPE_PUBLISHABLE_KEY");
  requireSecret(env.STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET");
  requireSecret(env.STRIPE_MERCHANT_IDENTIFIER, "STRIPE_MERCHANT_IDENTIFIER");
  requireSecret(env.INITIAL_ADMIN_EMAIL, "INITIAL_ADMIN_EMAIL");
  requireSecret(env.INITIAL_ADMIN_PASSWORD, "INITIAL_ADMIN_PASSWORD", 12);
  check(env.AUTH_PROVIDER === "firebase", "AUTH_PROVIDER must be firebase.");
  requireSecret(env.FIREBASE_WEB_API_KEY, "FIREBASE_WEB_API_KEY");
  requireSecret(env.COACH_INVITE_CODE, "COACH_INVITE_CODE", 12);
  requireUrl(env.EXPO_PUBLIC_API_BASE_URL, "EXPO_PUBLIC_API_BASE_URL");
  requireUrl(env.GOOD_VIBE_API_BASE_URL, "GOOD_VIBE_API_BASE_URL");
  for (const [name, value] of Object.entries(env)) {
    if (/^(APP_|AUTH_|DATABASE_|FIREBASE_|OSS_|STRIPE_|INITIAL_|EXPO_PUBLIC_|GOOD_VIBE_)/.test(name)) {
      check(!/replace|example\.com|YOUR_|ENCODED_PASSWORD/i.test(String(value)), `${name} still contains a placeholder.`);
    }
  }
}

for (const notice of notices) console.log(`NOTICE: ${notice}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Release preflight passed.");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readEnvFile(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      })
  );
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function requireSecret(value, name, minimumLength = 1) {
  check(Boolean(value?.trim()) && value.trim().length >= minimumLength, `${name} is missing or invalid.`);
}

function requireUrl(value, name, requiredHostSuffix) {
  try {
    const parsed = new URL(value);
    check(parsed.protocol === "https:", `${name} must use HTTPS.`);
    if (requiredHostSuffix) {
      check(parsed.hostname.endsWith(requiredHostSuffix), `${name} has an unexpected host.`);
    }
  } catch {
    errors.push(`${name} is missing or is not a valid URL.`);
  }
}

function requirePostgresUrl(value, name) {
  try {
    const parsed = new URL(value);
    check(["postgres:", "postgresql:"].includes(parsed.protocol), `${name} must be a PostgreSQL URL.`);
    check(Boolean(parsed.hostname), `${name} must include a database host.`);
    check(Boolean(parsed.pathname?.slice(1)), `${name} must include a database name.`);
  } catch {
    errors.push(`${name} is missing or is not a valid PostgreSQL URL.`);
  }
}
