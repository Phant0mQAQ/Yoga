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
check(appJson.expo?.ios?.bundleIdentifier === "com.yomiyoga.studio", "Unexpected iOS bundle identifier.");
check(
  appJson.expo?.plugins?.some(
    (plugin) => Array.isArray(plugin)
      && plugin[0] === "@stripe/stripe-react-native"
      && plugin[1]?.merchantIdentifier === "merchant.com.yomiyoga.studio"
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
  requireSecret(env.EXPO_PUBLIC_API_BASE_URL, "EXPO_PUBLIC_API_BASE_URL");
  requireSecret(env.YOMI_API_BASE_URL, "YOMI_API_BASE_URL");
  if (!env.SUPABASE_ACCESS_TOKEN) {
    notices.push("SUPABASE_ACCESS_TOKEN is not set; interactive `supabase login` is required.");
  }
  if (!env.EXPO_TOKEN) {
    notices.push("EXPO_TOKEN is not set; interactive `eas login` is required.");
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
