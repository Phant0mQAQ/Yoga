import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import "./mobile-pwa.test.js";

const BRAND_NAME = "Good Vibe Pilates & Yoga";
const SOURCE_LOGO_SHA256 = "3fd17dac4069cbec24fed352d79a275d88d050b88839e837bf4f44356f45fa26";

const appJson = readJson("apps/mobile-expo/app.json");
const manifest = readJson("apps/mobile/manifest.webmanifest");
const mobilePackage = readJson("apps/mobile-expo/package.json");

assert.equal(appJson.expo.name, BRAND_NAME);
assert.equal(appJson.expo.icon, "./assets/good-vibe-icon.png");
assert.equal(appJson.expo.ios.icon, "./assets/good-vibe-icon.png");
assert.equal(appJson.expo.splash.image, "./assets/good-vibe-logo.png");
assert.equal(appJson.expo.splash.backgroundColor.toUpperCase(), "#AAA5A3");
assert.equal(appJson.expo.android.adaptiveIcon.foregroundImage, "./assets/good-vibe-adaptive-icon.png");
assert.equal(appJson.expo.android.adaptiveIcon.backgroundColor.toUpperCase(), "#AAA5A3");
assert.deepEqual(appJson.expo.android.permissions, ["android.permission.CAMERA"]);
assert.ok(appJson.expo.android.blockedPermissions.includes("android.permission.RECORD_AUDIO"));
const cameraPlugin = appJson.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-camera");
assert.equal(cameraPlugin?.[1]?.recordAudioAndroid, false);
assert.equal(cameraPlugin?.[1]?.microphonePermission, false);
const imagePickerPlugin = appJson.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-image-picker");
assert.equal(imagePickerPlugin?.[1]?.microphonePermission, false);

assert.equal(appJson.expo.slug, "good-vibe-pilates-yoga");
assert.equal(appJson.expo.scheme, "goodvibe");
assert.equal(appJson.expo.ios.bundleIdentifier, "com.goodvibe.pilatesyoga");
assert.match(mobilePackage.dependencies.expo, /^~54\./, "Expo must remain on SDK 54");

assert.equal(manifest.name, BRAND_NAME);
assert.equal(manifest.short_name, "Good Vibe");
assert.deepEqual(
  manifest.icons.map(({ src, sizes }) => [src, sizes]),
  [
    ["/app/assets/good-vibe-icon-192.png", "192x192"],
    ["/app/assets/good-vibe-icon-512.png", "512x512"]
  ]
);

const assets = [
  ["apps/mobile-expo/assets/good-vibe-logo.png", 558, 660, 2],
  ["apps/mobile-expo/assets/good-vibe-icon.png", 1024, 1024, 2],
  ["apps/mobile-expo/assets/good-vibe-adaptive-icon.png", 1024, 1024, 6],
  ["apps/admin/assets/good-vibe-logo.png", 558, 660, 2],
  ["apps/admin/assets/good-vibe-icon.png", 512, 512, 2],
  ["apps/mobile/assets/good-vibe-logo.png", 558, 660, 2],
  ["apps/mobile/assets/good-vibe-icon-192.png", 192, 192, 2],
  ["apps/mobile/assets/good-vibe-icon-512.png", 512, 512, 2]
];

for (const [file, expectedWidth, expectedHeight, expectedColorType] of assets) {
  const { width, height, colorType } = pngMetadata(file);
  assert.equal(width, expectedWidth, `${file} has the wrong width`);
  assert.equal(height, expectedHeight, `${file} has the wrong height`);
  assert.equal(colorType, expectedColorType, `${file} has the wrong PNG color type`);
}

for (const logo of [
  "apps/mobile-expo/assets/good-vibe-logo.png",
  "apps/admin/assets/good-vibe-logo.png",
  "apps/mobile/assets/good-vibe-logo.png"
]) {
  assert.equal(sha256(logo), SOURCE_LOGO_SHA256, `${logo} must remain byte-for-byte identical to the supplied logo`);
}

for (const removedAsset of [
  "apps/mobile-expo/assets/icon.png",
  "apps/mobile-expo/assets/adaptive-icon.png",
  "apps/mobile-expo/assets/splash-icon.png",
]) {
  assert.equal(fs.existsSync(removedAsset), false, `${removedAsset} should have been replaced`);
}

const visibleBrandFiles = [
  "README.md",
  "apps/mobile-expo/app/(auth)/index.tsx",
  "apps/mobile-expo/app/(admin)/index.tsx",
  "apps/mobile-expo/src/api/client.ts",
  "apps/mobile-expo/src/components/ui.tsx",
  "apps/mobile-expo/src/i18n/index.ts",
  "apps/admin/index.html",
  "apps/admin/app.js",
  "apps/admin/build.mjs",
  "apps/mobile/index.html",
  "apps/mobile/app.js",
  "apps/mobile/manifest.webmanifest",
  "apps/api/server.js",
  "apps/api/src/store-repository.js",
  "apps/api/src/stripe-provider.js",
  "docs/openapi.yaml"
];

const oldVisibleBrand = /Yoga Booking API|Yoga booking API/;
for (const file of visibleBrandFiles) {
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), oldVisibleBrand, `${file} contains old visible branding`);
}

const retiredIdentifier = new RegExp(
  `${["yo", "mi"].join("")}|${["yoga", "booking"].join("")}|${["Yoga", "Booking", "App"].join("")}`,
  "i"
);
for (const file of sourceTextFiles(".")) {
  assert.doesNotMatch(file, retiredIdentifier, `${file} still uses a retired project identifier`);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), retiredIdentifier, `${file} still uses a retired project identifier`);
}

console.log("brand tests passed");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function pngMetadata(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${file} is not a PNG`);
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR", `${file} has no IHDR chunk`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25]
  };
}

function sourceTextFiles(directory) {
  const excludedDirectories = new Set([".git", ".expo", "node_modules", "dist", "dist-export-check", "dist-final-check"]);
  const textExtensions = new Set([".example", ".js", ".json", ".md", ".mjs", ".sql", ".swift", ".toml", ".ts", ".tsx", ".yaml", ".yml"]);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (
        !excludedDirectories.has(entry.name)
        && !entry.name.startsWith(".")
        && !entry.name.startsWith("dist")
        && entry.name !== "output"
      ) {
        files.push(...sourceTextFiles(`${directory}/${entry.name}`));
      }
      continue;
    }
    const file = `${directory}/${entry.name}`;
    if (file.endsWith("tests/brand.test.js")) continue;
    if (textExtensions.has(entry.name === ".env.example" ? ".example" : file.slice(file.lastIndexOf(".")))) files.push(file);
  }
  return files;
}
