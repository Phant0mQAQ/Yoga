import { createRequire } from "node:module";

const STATE_ID = "primary";
const STATE_TABLE = "public.good_vibe_app_state";
export function createStoreRepository({
  d1Database = globalThis.__GOOD_VIBE_D1__,
  databaseUrl = process.env.DATABASE_URL,
  postgresPool,
  postgresSslMode = process.env.DATABASE_SSL_MODE,
  postgresSslCaBase64 = process.env.DATABASE_SSL_CA_BASE64,
  supabaseUrl = process.env.SUPABASE_URL,
  secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  serviceRoleKey,
  fetchImpl = globalThis.fetch
} = {}) {
  if (d1Database) {
    return createD1Repository(d1Database);
  }

  if (databaseUrl || postgresPool) {
    if (!databaseUrl && !postgresPool) {
      throw new Error("DATABASE_URL is required for PostgreSQL persistence");
    }
    return createPostgresRepository({
      pool: postgresPool ?? createPostgresPool(databaseUrl, postgresSslMode, postgresSslCaBase64)
    });
  }

  const databaseKey = secretKey ?? serviceRoleKey;
  if (!supabaseUrl && !databaseKey) {
    return createMemoryRepository();
  }
  if (!supabaseUrl || !databaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be configured together");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for Supabase persistence");
  }

  return createSupabaseRepository({
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    secretKey: databaseKey,
    fetchImpl
  });
}

function createD1Repository(database) {
  if (typeof database.prepare !== "function") {
    throw new Error("A valid Cloudflare D1 binding is required");
  }
  let version = 0;
  let initialization;

  async function initialize() {
    initialization ??= database.prepare(`CREATE TABLE IF NOT EXISTS good_vibe_app_state (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`).run().catch((error) => {
        initialization = null;
        throw error;
      });
    await initialization;
  }

  async function selectState() {
    return database
      .prepare("SELECT state, version FROM good_vibe_app_state WHERE id = ?1")
      .bind(STATE_ID)
      .first();
  }

  return {
    kind: "cloudflare-d1",
    enabled: true,
    async load(seedStore) {
      await initialize();
      let existing = await selectState();
      if (!existing) {
        await database
          .prepare(`
            INSERT OR IGNORE INTO good_vibe_app_state (id, state, version, updated_at)
            VALUES (?1, ?2, 1, CURRENT_TIMESTAMP)
          `)
          .bind(STATE_ID, JSON.stringify(seedStore))
          .run();
        existing = await selectState();
      }
      if (!existing) throw new Error("Cloudflare D1 did not return the application state row");
      version = Number(existing.version);
      return mergeStore(seedStore, JSON.parse(existing.state));
    },
    async save(store) {
      const nextVersion = version + 1;
      const result = await database
        .prepare(`
          UPDATE good_vibe_app_state
          SET state = ?1, version = ?2, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?3 AND version = ?4
        `)
        .bind(JSON.stringify(store), nextVersion, STATE_ID, version)
        .run();
      if (!result.meta?.changes) {
        const error = new Error("Cloudflare D1 state was updated by another Worker isolate");
        error.status = 409;
        error.code = "database_write_conflict";
        throw error;
      }
      version = nextVersion;
      return { persisted: true, version };
    }
  };
}

function createPostgresPool(databaseUrl, sslMode, sslCaBase64) {
  let Pool;
  try {
    const require = createRequire(import.meta.url);
    ({ Pool } = require("pg"));
  } catch (cause) {
    const error = new Error("The pg package is required when DATABASE_URL is configured");
    error.cause = cause;
    throw error;
  }
  return new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: postgresSslOptions(sslMode, sslCaBase64)
  });
}

function postgresSslOptions(mode, caBase64) {
  const normalized = String(mode ?? "disable").toLowerCase();
  if (["", "disable", "false", "off"].includes(normalized)) return false;
  if (["require", "true", "on"].includes(normalized)) return { rejectUnauthorized: false };
  if (normalized === "verify-full") {
    if (!caBase64) throw new Error("DATABASE_SSL_CA_BASE64 is required when DATABASE_SSL_MODE=verify-full");
    return { rejectUnauthorized: true, ca: Buffer.from(caBase64, "base64").toString("utf8") };
  }
  throw new Error("DATABASE_SSL_MODE must be disable, require, or verify-full");
}

function createPostgresRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("A PostgreSQL pool with a query method is required");
  }
  let version = 0;

  async function query(text, values = []) {
    try {
      return await pool.query(text, values);
    } catch (cause) {
      if (cause?.code === "database_write_conflict") throw cause;
      const error = new Error("PostgreSQL persistence is unavailable");
      error.status = 503;
      error.code = "database_unavailable";
      error.cause = cause;
      throw error;
    }
  }

  async function selectState() {
    const result = await query(`select state, version from ${STATE_TABLE} where id = $1`, [STATE_ID]);
    return result.rows?.[0];
  }

  return {
    kind: "postgres",
    enabled: true,
    async load(seedStore) {
      let existing = await selectState();
      if (!existing) {
        const inserted = await query(
          `insert into ${STATE_TABLE} (id, state, version)
           values ($1, $2::jsonb, 1)
           on conflict (id) do nothing
           returning state, version`,
          [STATE_ID, JSON.stringify(seedStore)]
        );
        existing = inserted.rows?.[0] ?? await selectState();
      }
      if (!existing) throw new Error("PostgreSQL did not return the application state row");
      version = Number(existing.version);
      return mergeStore(seedStore, parsePostgresState(existing.state));
    },
    async save(store) {
      const nextVersion = version + 1;
      const result = await query(
        `update ${STATE_TABLE}
         set state = $1::jsonb, version = $2, updated_at = now()
         where id = $3 and version = $4
         returning version`,
        [JSON.stringify(store), nextVersion, STATE_ID, version]
      );
      if (!result.rows?.length) {
        const error = new Error("PostgreSQL state was updated by another API instance");
        error.status = 409;
        error.code = "database_write_conflict";
        throw error;
      }
      version = Number(result.rows[0].version);
      return { persisted: true, version };
    }
  };
}

function parsePostgresState(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("PostgreSQL contains an invalid application state document");
  }
}

function createMemoryRepository() {
  return {
    kind: "memory",
    enabled: false,
    async load(seedStore) {
      return seedStore;
    },
    async save() {
      return { persisted: false };
    }
  };
}

function createSupabaseRepository({ supabaseUrl, secretKey, fetchImpl }) {
  let version = 0;
  const endpoint = `${supabaseUrl}/rest/v1/good_vibe_app_state`;

  async function request(path, options = {}) {
    const response = await fetchImpl(`${endpoint}${path}`, {
      ...options,
      headers: {
        apikey: secretKey,
        ...(!secretKey.startsWith("sb_secret_")
          ? { Authorization: `Bearer ${secretKey}` }
          : {}),
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = data?.message ?? data?.hint ?? `Supabase request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = 503;
      error.code = "database_unavailable";
      throw error;
    }
    return data;
  }

  return {
    kind: "supabase",
    enabled: true,
    async load(seedStore) {
      const rows = await request(`?id=eq.${STATE_ID}&select=state,version`, {
        method: "GET"
      });
      const existing = rows?.[0];
      if (existing) {
        version = Number(existing.version);
        return mergeStore(seedStore, existing.state);
      }

      const created = await request("", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          id: STATE_ID,
          state: seedStore,
          version: 1
        })
      });
      const row = created?.[0];
      version = Number(row?.version ?? 1);
      return mergeStore(seedStore, row?.state ?? seedStore);
    },
    async save(store) {
      const nextVersion = version + 1;
      const rows = await request(`?id=eq.${STATE_ID}&version=eq.${version}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          state: store,
          version: nextVersion,
          updated_at: new Date().toISOString()
        })
      });
      if (!rows?.length) {
        const error = new Error("Supabase state was updated by another API instance");
        error.status = 409;
        error.code = "database_write_conflict";
        throw error;
      }
      version = Number(rows[0].version);
      return { persisted: true, version };
    }
  };
}

function mergeStore(seedStore, persistedStore) {
  if (!persistedStore || typeof persistedStore !== "object" || Array.isArray(persistedStore)) {
    throw new Error("Persistence contains an invalid Good Vibe Pilates & Yoga state document");
  }
  return Object.fromEntries(
    Object.entries(seedStore).map(([key, seedValue]) => {
      const persistedValue = persistedStore[key];
      if (Array.isArray(seedValue)) {
        return [key, Array.isArray(persistedValue) ? persistedValue : seedValue];
      }
      return [key, persistedValue ?? seedValue];
    })
  );
}

export function restoreStore(target, snapshot) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, snapshot);
}
