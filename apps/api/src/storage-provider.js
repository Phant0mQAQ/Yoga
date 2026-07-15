export function createStorageUploadProvider({
  supabaseUrl = process.env.SUPABASE_URL,
  secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket = process.env.SUPABASE_STORAGE_BUCKET,
  fetchImpl = globalThis.fetch,
  now = () => Date.now()
} = {}) {
  const normalizedBucket = String(bucket ?? "").trim();
  if (!normalizedBucket) {
    return {
      kind: "memory",
      enabled: false,
      async createSignedUpload() {
        throw storageProblem(503, "storage_not_configured", "SUPABASE_STORAGE_BUCKET is not configured");
      }
    };
  }
  if (/[\\/]/.test(normalizedBucket)) {
    return {
      kind: "misconfigured",
      enabled: false,
      async createSignedUpload() {
        throw storageProblem(503, "invalid_storage_bucket", "SUPABASE_STORAGE_BUCKET must be a bucket name without slashes");
      }
    };
  }
  if (!supabaseUrl || !secretKey) {
    return {
      kind: "misconfigured",
      enabled: false,
      async createSignedUpload() {
        throw storageProblem(503, "storage_not_configured", "Supabase Storage requires SUPABASE_URL and SUPABASE_SECRET_KEY");
      }
    };
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for Supabase Storage");
  }

  const storageBaseUrl = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1`;
  const encodedBucket = encodeURIComponent(normalizedBucket);
  return {
    kind: "supabase",
    enabled: true,
    async createSignedUpload({ objectKey, upsert = false }) {
      const encodedObjectKey = encodeStoragePath(objectKey);
      const endpoint = `${storageBaseUrl}/object/upload/sign/${encodedBucket}/${encodedObjectKey}`;
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            apikey: secretKey,
            ...(!secretKey.startsWith("sb_secret_") ? { Authorization: `Bearer ${secretKey}` } : {}),
            "Content-Type": "application/json",
            "x-upsert": String(Boolean(upsert))
          },
          body: "{}"
        });
      } catch (cause) {
        const error = storageProblem(503, "storage_unavailable", "Could not reach Supabase Storage");
        error.cause = cause;
        throw error;
      }
      const raw = await response.text();
      let data = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw storageProblem(502, "invalid_storage_response", "Supabase Storage returned an invalid response");
        }
      }
      if (!response.ok) {
        const error = storageProblem(
          502,
          "storage_error",
          data?.message ?? data?.error ?? `Supabase Storage request failed with ${response.status}`
        );
        error.storage = data;
        throw error;
      }
      if (typeof data.url !== "string" || !data.url) {
        throw storageProblem(502, "invalid_storage_response", "Supabase Storage did not return a signed upload URL");
      }
      const uploadUrl = data.url.startsWith("http://") || data.url.startsWith("https://")
        ? data.url
        : `${storageBaseUrl}${data.url.startsWith("/") ? "" : "/"}${data.url}`;
      return {
        storage: "supabase",
        objectKey,
        uploadUrl,
        publicUrl: `${storageBaseUrl}/object/public/${encodedBucket}/${encodedObjectKey}`,
        expiresAt: new Date(now() + 2 * 60 * 60 * 1000).toISOString()
      };
    }
  };
}

function encodeStoragePath(value) {
  return String(value)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function storageProblem(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
