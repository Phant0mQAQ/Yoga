import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const sourceUrl = required("SUPABASE_SOURCE_URL").replace(/\/+$/, "");
const sourceSecret = required("SUPABASE_SOURCE_SECRET_KEY");
const sourceBucket = process.env.SUPABASE_SOURCE_STORAGE_BUCKET?.trim();
const databaseUrl = required("DATABASE_URL");

const sourceResponse = await fetch(`${sourceUrl}/rest/v1/good_vibe_app_state?id=eq.primary&select=state,version`, {
  headers: supabaseHeaders(sourceSecret)
});
const raw = await sourceResponse.text();
if (!sourceResponse.ok) throw new Error(`Could not read Supabase state (${sourceResponse.status}): ${raw}`);
const sourceRows = raw ? JSON.parse(raw) : [];
if (!sourceRows[0]?.state) throw new Error("Supabase does not contain the primary Good Vibe state row");

const sourceRow = sourceRows[0];
const sourceAssetBase = sourceBucket
  ? `${sourceUrl}/storage/v1/object/public/${encodeURIComponent(sourceBucket)}`
  : null;
const targetAssetBase = process.env.OSS_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || null;
const migratedState = sourceAssetBase && targetAssetBase
  ? replacePublicAssetUrls(sourceRow.state, sourceAssetBase, targetAssetBase)
  : sourceRow.state;

console.log(JSON.stringify({
  mode: dryRun ? "dry-run" : "write",
  sourceVersion: Number(sourceRow.version),
  collections: collectionCounts(migratedState),
  assetUrlsRewritten: Boolean(sourceAssetBase && targetAssetBase)
}, null, 2));

if (dryRun) process.exit(0);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: postgresSslOptions(),
  max: 1,
  connectionTimeoutMillis: 10_000
});

try {
  const schema = await fs.readFile(path.join(root, "db", "alibaba-rds.sql"), "utf8");
  await pool.query(schema);
  const existing = await pool.query("select version from public.good_vibe_app_state where id = $1", ["primary"]);
  if (existing.rows.length && !force) {
    throw new Error("RDS already contains the primary state row. Re-run with --force only after verifying a backup.");
  }
  await pool.query("begin");
  await pool.query(
    `insert into public.good_vibe_app_state (id, state, version, updated_at)
     values ($1, $2::jsonb, $3, now())
     on conflict (id) do update
     set state = excluded.state, version = excluded.version, updated_at = now()`,
    ["primary", JSON.stringify(migratedState), Number(sourceRow.version) || 1]
  );
  await pool.query("commit");
  const verified = await pool.query("select version, state from public.good_vibe_app_state where id = $1", ["primary"]);
  console.log(`RDS migration complete at version ${verified.rows[0].version}.`);
  console.log(JSON.stringify({ collections: collectionCounts(verified.rows[0].state) }, null, 2));
} catch (error) {
  await pool.query("rollback").catch(() => {});
  throw error;
} finally {
  await pool.end();
}

function replacePublicAssetUrls(value, sourceBase, targetBase) {
  if (typeof value === "string") return value.startsWith(`${sourceBase}/`) ? `${targetBase}${value.slice(sourceBase.length)}` : value;
  if (Array.isArray(value)) return value.map((item) => replacePublicAssetUrls(item, sourceBase, targetBase));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replacePublicAssetUrls(item, sourceBase, targetBase)])
  );
}

function collectionCounts(state) {
  return Object.fromEntries(
    Object.entries(state).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])
  );
}

function supabaseHeaders(secret) {
  return {
    apikey: secret,
    ...(!secret.startsWith("sb_secret_") ? { Authorization: `Bearer ${secret}` } : {}),
    Accept: "application/json"
  };
}

function postgresSslOptions() {
  const mode = String(process.env.DATABASE_SSL_MODE ?? "disable").toLowerCase();
  if (["", "disable", "false", "off"].includes(mode)) return false;
  if (["require", "true", "on"].includes(mode)) return { rejectUnauthorized: false };
  if (mode === "verify-full") {
    return {
      rejectUnauthorized: true,
      ca: Buffer.from(required("DATABASE_SSL_CA_BASE64"), "base64").toString("utf8")
    };
  }
  throw new Error("DATABASE_SSL_MODE must be disable, require, or verify-full");
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
