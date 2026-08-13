import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import OSS from "ali-oss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminRoot = path.join(root, "apps", "admin");
const outputDir = path.join(adminRoot, "dist");
required("GOOD_VIBE_API_BASE_URL");

const build = spawnSync(process.execPath, [path.join(adminRoot, "build.mjs")], {
  cwd: root,
  env: process.env,
  stdio: "inherit"
});
if (build.status !== 0) process.exit(build.status ?? 1);

const client = new OSS({
  region: normalizeOssRegion(process.env.OSS_ADMIN_REGION ?? required("OSS_REGION")),
  accessKeyId: required("OSS_ACCESS_KEY_ID"),
  accessKeySecret: required("OSS_ACCESS_KEY_SECRET"),
  bucket: required("OSS_ADMIN_BUCKET"),
  secure: true,
  authorizationV4: true
});

const files = await walk(outputDir);
let uploaded = 0;
for (const filePath of files) {
  const objectKey = path.relative(outputDir, filePath).split(path.sep).join("/");
  const immutable = objectKey.startsWith("assets/");
  await client.put(objectKey, filePath, {
    headers: {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": immutable ? "public, max-age=86400" : "no-cache, no-store, must-revalidate"
    }
  });
  uploaded += 1;
  console.log(`[${uploaded}/${files.length}] ${objectKey}`);
}
console.log(`Uploaded ${uploaded} admin site file(s) to OSS bucket ${process.env.OSS_ADMIN_BUCKET}.`);

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return nested.flat();
}

function contentTypeFor(filePath) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  })[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function normalizeOssRegion(value) {
  const normalized = String(value).trim();
  return normalized.startsWith("oss-") ? normalized : `oss-${normalized}`;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
