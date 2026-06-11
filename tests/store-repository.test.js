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
assert.ok(requests[0].url.includes("yomi_app_state"));

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

console.log("store repository tests passed");

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
