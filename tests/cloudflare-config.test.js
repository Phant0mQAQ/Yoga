import assert from "node:assert/strict";
import fs from "node:fs";

const config = JSON.parse(fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const worker = fs.readFileSync(new URL("../deploy/cloudflare/worker.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../apps/api/server.js", import.meta.url), "utf8");
const mobileClient = fs.readFileSync(new URL("../apps/mobile-expo/src/api/client.ts", import.meta.url), "utf8");
const cloudflareBuild = fs.readFileSync(new URL("../scripts/build-cloudflare.mjs", import.meta.url), "utf8");

assert.equal(
  config.build?.command,
  "npm run build:cloudflare",
  "Wrangler must build static assets before local, preview, or production uploads"
);
assert.equal(
  packageJson.scripts?.["deploy:cloudflare"],
  "wrangler deploy",
  "The deployment script must rely on Wrangler's shared custom build step"
);
assert.deepEqual(
  packageJson.workspaces,
  ["apps/admin", "apps/mobile-expo"],
  "Cloudflare clean installs must include the Expo application dependencies"
);
assert.equal(
  config.vars?.AUTH_PROVIDER,
  "local",
  "The public Cloudflare review deployment must keep the seeded review accounts available"
);
assert.equal(
  config.define?.["process.env.NODE_ENV"],
  "\"development\"",
  "The public Cloudflare demo must not be confused with the hardened production configuration"
);
assert.deepEqual(
  config.r2_buckets,
  [{ binding: "MEDIA", bucket_name: "good-vibe-avatar-assets" }],
  "Cloudflare must bind durable R2 storage for course, content, and profile images"
);
assert.match(worker, /globalThis\.__GOOD_VIBE_MEDIA_BUCKET__ = env\.MEDIA/);
assert.match(worker, /await env\.MEDIA\.get\(objectKey\)/);
assert.match(worker, /\["avatars\/", "courses\/", "content\/"\]/);
assert.match(worker, /object\.writeHttpMetadata\(headers\)/);
assert.match(server, /globalThis\.__GOOD_VIBE_MEDIA_BUCKET__/);
assert.match(server, /\/api\/v1\/admin\/uploads\//);
assert.match(server, /requireRole\(auth, \[ROLES\.ADMIN\]\)/);
assert.match(server, /cloudflareMediaBucket\.put\(objectKey, body/);
assert.match(mobileClient, /uploadAdminFile/);
assert.match(mobileClient, /headers\.Authorization = `Bearer \$\{authToken\}`/);
assert.match(cloudflareBuild, /patchMobileWebDocument/);
assert.match(cloudflareBuild, /viewport-fit=cover/);
assert.match(cloudflareBuild, /apple-mobile-web-app-capable/);
assert.match(cloudflareBuild, /apple-mobile-web-app-status-bar-style/);

console.log("Cloudflare staging authentication config tests passed");
