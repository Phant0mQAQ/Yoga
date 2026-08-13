import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".cloudflare", "public");
const mobileExpoRoot = path.join(root, "apps", "mobile-expo");
const mobileExpoOutput = path.join(root, ".cloudflare", "mobile-expo-web");
const mobileRequire = createRequire(path.join(mobileExpoRoot, "package.json"));
const expoCli = mobileRequire.resolve("expo/bin/cli");

fs.rmSync(mobileExpoOutput, { recursive: true, force: true });
execFileSync(process.execPath, [
  expoCli,
  "export",
  "--platform",
  "web",
  "--clear",
  "--output-dir",
  mobileExpoOutput
], {
  cwd: mobileExpoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL
      ?? "https://good-vibe-pilates-yoga.2316196563.workers.dev/api/v1"
  }
});

patchMobileWebDocument(path.join(mobileExpoOutput, "index.html"));

emptyDirectory(output);
const adminOutput = path.join(output, "admin");
fs.mkdirSync(adminOutput, { recursive: true });
for (const file of ["index.html", "app.js", "styles.css", "config.js"]) {
  fs.copyFileSync(path.join(root, "apps", "admin", file), path.join(adminOutput, file));
}
fs.cpSync(path.join(root, "apps", "admin", "assets"), path.join(adminOutput, "assets"), { recursive: true });
fs.cpSync(mobileExpoOutput, path.join(output, "app"), { recursive: true });

console.log(`Built Cloudflare assets in ${output}`);

function patchMobileWebDocument(file) {
  const defaultViewport = '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />';
  const safeViewport = [
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />',
    '    <meta name="apple-mobile-web-app-capable" content="yes" />',
    '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />'
  ].join("\n");
  const document = fs.readFileSync(file, "utf8");

  if (!document.includes(defaultViewport)) {
    throw new Error("Expo Web viewport template changed; safe-area metadata was not applied");
  }

  fs.writeFileSync(file, document.replace(defaultViewport, safeViewport));
}

function emptyDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const entry of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
  }
}
