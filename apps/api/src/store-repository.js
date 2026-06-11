const STATE_ID = "primary";

export function createStoreRepository({
  supabaseUrl = process.env.SUPABASE_URL,
  secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  serviceRoleKey,
  fetchImpl = globalThis.fetch
} = {}) {
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
  const endpoint = `${supabaseUrl}/rest/v1/yomi_app_state`;

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
    throw new Error("Supabase contains an invalid Yomi Yoga state document");
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
