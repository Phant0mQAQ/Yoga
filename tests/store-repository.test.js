import assert from "node:assert/strict";
import { createStoreRepository, restoreStore } from "../apps/api/src/store-repository.js";

const seed = {
  users: [{ id: "usr_seed" }],
  bookings: [],
  auditLogs: []
};

const memory = createStoreRepository({
  supabaseUrl: "",
  serviceRoleKey: ""
});
assert.equal(memory.kind, "memory");
assert.equal(await memory.load(seed), seed);

assert.throws(() => createStoreRepository({
  supabaseUrl: "https://example.supabase.co",
  serviceRoleKey: ""
}), /SUPABASE_SECRET_KEY must be configured together/);

const requests = [];
const responses = [
  jsonResponse([]),
  jsonResponse([{ state: seed, version: 1 }]),
  jsonResponse([{ version: 2 }])
];
const repository = createStoreRepository({
  supabaseUrl: "https://example.supabase.co",
  serviceRoleKey: "service-role-secret",
  fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return responses.shift();
  }
});

const loaded = await repository.load(structuredClone(seed));
assert.deepEqual(loaded, seed);
assert.equal(repository.kind, "supabase");
assert.equal(requests[0].options.headers.apikey, "service-role-secret");
assert.equal(requests[0].options.headers.Authorization, "Bearer service-role-secret");
assert.ok(requests[0].url.includes("good_vibe_app_state"));

loaded.bookings.push({ id: "bkg_1" });
const saved = await repository.save(loaded);
assert.deepEqual(saved, { persisted: true, version: 2 });
assert.ok(requests[2].url.includes("version=eq.1"));
assert.equal(JSON.parse(requests[2].options.body).state.bookings[0].id, "bkg_1");

const target = { users: [], bookings: [{ id: "changed" }] };
restoreStore(target, seed);
assert.deepEqual(target, seed);

const conflictRepository = createStoreRepository({
  supabaseUrl: "https://example.supabase.co",
  serviceRoleKey: "service-role-secret",
  fetchImpl: async (url, options) => {
    if (options.method === "GET") return jsonResponse([{ state: seed, version: 4 }]);
    return jsonResponse([]);
  }
});
await conflictRepository.load(structuredClone(seed));
await assert.rejects(() => conflictRepository.save(seed), /updated by another API instance/);

const secretKeyRequests = [];
const secretKeyRepository = createStoreRepository({
  supabaseUrl: "https://example.supabase.co",
  secretKey: "sb_secret_server_key",
  fetchImpl: async (url, options) => {
    secretKeyRequests.push({ url, options });
    return jsonResponse([{ state: seed, version: 1 }]);
  }
});
await secretKeyRepository.load(structuredClone(seed));
assert.equal(secretKeyRequests[0].options.headers.apikey, "sb_secret_server_key");
assert.equal(secretKeyRequests[0].options.headers.Authorization, undefined);

const d1State = { row: null };
const d1Database = {
  prepare(sql) {
    let values = [];
    return {
      bind(...nextValues) {
        values = nextValues;
        return this;
      },
      async first() {
        return d1State.row ? structuredClone(d1State.row) : null;
      },
      async run() {
        const normalized = sql.trim().toUpperCase();
        if (normalized.startsWith("CREATE TABLE")) return { meta: { changes: 0 } };
        if (normalized.startsWith("INSERT OR IGNORE")) {
          if (!d1State.row) d1State.row = { state: values[1], version: 1 };
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith("UPDATE")) {
          if (!d1State.row || Number(d1State.row.version) !== Number(values[3])) {
            return { meta: { changes: 0 } };
          }
          d1State.row = { state: values[0], version: Number(values[1]) };
          return { meta: { changes: 1 } };
        }
        throw new Error(`Unexpected D1 query: ${sql}`);
      }
    };
  }
};
const d1Repository = createStoreRepository({ d1Database });
assert.equal(d1Repository.kind, "cloudflare-d1");
const d1Loaded = await d1Repository.load(structuredClone(seed));
d1Loaded.bookings.push({ id: "bkg_d1" });
assert.deepEqual(await d1Repository.save(d1Loaded), { persisted: true, version: 2 });
assert.equal(JSON.parse(d1State.row.state).bookings[0].id, "bkg_d1");

const staleD1Repository = createStoreRepository({ d1Database });
const staleD1Store = await staleD1Repository.load(structuredClone(seed));
d1Loaded.auditLogs.push({ id: "aud_d1_newer" });
await d1Repository.save(d1Loaded);
staleD1Store.auditLogs.push({ id: "aud_d1_stale" });
await assert.rejects(
  () => staleD1Repository.save(staleD1Store),
  (error) => error?.code === "database_write_conflict"
);
const refreshedD1Store = await staleD1Repository.load(structuredClone(seed));
refreshedD1Store.auditLogs.push({ id: "aud_d1_refreshed" });
assert.deepEqual(await staleD1Repository.save(refreshedD1Store), { persisted: true, version: 4 });
assert.deepEqual(
  JSON.parse(d1State.row.state).auditLogs.map((entry) => entry.id),
  ["aud_d1_newer", "aud_d1_refreshed"]
);

const postgresState = { row: null };
const postgresPool = {
  async query(sql, values) {
    if (/^select state, version/i.test(sql.trim())) {
      return { rows: postgresState.row ? [structuredClone(postgresState.row)] : [] };
    }
    if (/^insert into/i.test(sql.trim())) {
      if (!postgresState.row) postgresState.row = { state: JSON.parse(values[1]), version: 1 };
      return { rows: [structuredClone(postgresState.row)] };
    }
    if (/^update/i.test(sql.trim())) {
      if (!postgresState.row || Number(postgresState.row.version) !== Number(values[3])) return { rows: [] };
      postgresState.row = { state: JSON.parse(values[0]), version: Number(values[1]) };
      return { rows: [{ version: postgresState.row.version }] };
    }
    throw new Error(`Unexpected PostgreSQL query: ${sql}`);
  }
};
const postgresRepository = createStoreRepository({ postgresPool });
assert.equal(postgresRepository.kind, "postgres");
const postgresLoaded = await postgresRepository.load(structuredClone(seed));
postgresLoaded.bookings.push({ id: "bkg_rds" });
assert.deepEqual(await postgresRepository.save(postgresLoaded), { persisted: true, version: 2 });
assert.equal(postgresState.row.state.bookings[0].id, "bkg_rds");

const unavailablePostgres = createStoreRepository({
  postgresPool: { async query() { throw new Error("connection refused"); } }
});
await assert.rejects(
  unavailablePostgres.load(structuredClone(seed)),
  (error) => error?.code === "database_unavailable" && error?.status === 503
);

console.log("store repository tests passed");

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
