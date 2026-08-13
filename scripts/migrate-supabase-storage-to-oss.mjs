import OSS from "ali-oss";

const dryRun = process.argv.includes("--dry-run");
const sourceUrl = required("SUPABASE_SOURCE_URL").replace(/\/+$/, "");
const sourceSecret = required("SUPABASE_SOURCE_SECRET_KEY");
const sourceBucket = required("SUPABASE_SOURCE_STORAGE_BUCKET");
const targetBucket = required("OSS_BUCKET");
const targetRegion = normalizeOssRegion(required("OSS_REGION"));
const prefixArg = process.argv.find((value) => value.startsWith("--prefix="));
const rootPrefix = prefixArg ? prefixArg.slice("--prefix=".length).replace(/^\/+|\/+$/g, "") : "";

const client = new OSS({
  region: targetRegion,
  accessKeyId: required("OSS_ACCESS_KEY_ID"),
  accessKeySecret: required("OSS_ACCESS_KEY_SECRET"),
  bucket: targetBucket,
  secure: true,
  authorizationV4: true
});

const objects = await listObjects(rootPrefix);
console.log(`Found ${objects.length} Supabase Storage object(s)${rootPrefix ? ` under ${rootPrefix}` : ""}.`);
if (dryRun) {
  for (const objectKey of objects) console.log(`[dry-run] ${objectKey}`);
  process.exit(0);
}

let uploaded = 0;
for (const objectKey of objects) {
  const sourceObjectUrl = `${sourceUrl}/storage/v1/object/public/${encodeURIComponent(sourceBucket)}/${encodePath(objectKey)}`;
  const response = await fetch(sourceObjectUrl, { headers: supabaseHeaders(sourceSecret) });
  if (!response.ok) throw new Error(`Could not download ${objectKey} from Supabase (${response.status})`);
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const body = Buffer.from(await response.arrayBuffer());
  await client.put(objectKey, body, { headers: { "Content-Type": contentType } });
  uploaded += 1;
  console.log(`[${uploaded}/${objects.length}] ${objectKey}`);
}
console.log(`Migrated ${uploaded} object(s) to OSS bucket ${targetBucket}.`);

async function listObjects(prefix) {
  const objects = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const response = await fetch(`${sourceUrl}/storage/v1/object/list/${encodeURIComponent(sourceBucket)}`, {
      method: "POST",
      headers: { ...supabaseHeaders(sourceSecret), "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: "name", order: "asc" } })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Could not list Supabase Storage prefix ${prefix || "/"} (${response.status}): ${text}`);
    const entries = text ? JSON.parse(text) : [];
    for (const entry of entries) {
      const objectKey = [prefix, entry.name].filter(Boolean).join("/");
      if (entry.id == null && entry.metadata == null) objects.push(...await listObjects(objectKey));
      else objects.push(objectKey);
    }
    if (entries.length < limit) break;
    offset += limit;
  }
  return objects;
}

function supabaseHeaders(secret) {
  return {
    apikey: secret,
    ...(!secret.startsWith("sb_secret_") ? { Authorization: `Bearer ${secret}` } : {})
  };
}

function normalizeOssRegion(value) {
  return value.startsWith("oss-") ? value : `oss-${value}`;
}

function encodePath(value) {
  return value.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
