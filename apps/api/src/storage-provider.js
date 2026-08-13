import { createRequire } from "node:module";

export function createStorageUploadProvider({
  ossRegion = process.env.OSS_REGION,
  ossAccessKeyId = process.env.OSS_ACCESS_KEY_ID,
  ossAccessKeySecret = process.env.OSS_ACCESS_KEY_SECRET,
  ossBucket = process.env.OSS_BUCKET,
  ossPublicBaseUrl = process.env.OSS_PUBLIC_BASE_URL,
  ossClient,
  supabaseUrl = process.env.SUPABASE_URL,
  secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket = process.env.SUPABASE_STORAGE_BUCKET,
  fetchImpl = globalThis.fetch,
  now = () => Date.now()
} = {}) {
  const ossConfigured = Boolean(
    ossClient || ossRegion || ossAccessKeyId || ossAccessKeySecret || ossBucket || ossPublicBaseUrl
  );
  if (ossConfigured) {
    return createOssUploadProvider({
      region: ossRegion,
      accessKeyId: ossAccessKeyId,
      accessKeySecret: ossAccessKeySecret,
      bucket: ossBucket,
      publicBaseUrl: ossPublicBaseUrl,
      client: ossClient,
      now
    });
  }

  const normalizedBucket = String(bucket ?? "").trim();
  if (!normalizedBucket) {
    return {
      kind: "memory",
      enabled: false,
      publicUrlFor() {
        throw storageProblem(503, "storage_not_configured", "SUPABASE_STORAGE_BUCKET is not configured");
      },
      async createSignedUpload() {
        throw storageProblem(503, "storage_not_configured", "SUPABASE_STORAGE_BUCKET is not configured");
      }
    };
  }
  if (/[\\/]/.test(normalizedBucket)) {
    return {
      kind: "misconfigured",
      enabled: false,
      publicUrlFor() {
        throw storageProblem(503, "invalid_storage_bucket", "SUPABASE_STORAGE_BUCKET must be a bucket name without slashes");
      },
      async createSignedUpload() {
        throw storageProblem(503, "invalid_storage_bucket", "SUPABASE_STORAGE_BUCKET must be a bucket name without slashes");
      }
    };
  }
  if (!supabaseUrl || !secretKey) {
    return {
      kind: "misconfigured",
      enabled: false,
      publicUrlFor() {
        throw storageProblem(503, "storage_not_configured", "Supabase Storage requires SUPABASE_URL and SUPABASE_SECRET_KEY");
      },
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
    publicUrlFor(objectKey) {
      return `${storageBaseUrl}/object/public/${encodedBucket}/${encodeStoragePath(objectKey)}`;
    },
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
        publicUrl: this.publicUrlFor(objectKey),
        expiresAt: new Date(now() + 2 * 60 * 60 * 1000).toISOString()
      };
    }
  };
}

function createOssUploadProvider({ region, accessKeyId, accessKeySecret, bucket, publicBaseUrl, client, now }) {
  const normalizedBucket = String(bucket ?? client?.options?.bucket ?? "").trim();
  const normalizedRegion = normalizeOssRegion(region ?? client?.options?.region);
  const normalizedPublicBaseUrl = normalizePublicBaseUrl(publicBaseUrl);
  const missing = [
    !normalizedRegion && "OSS_REGION",
    !normalizedBucket && "OSS_BUCKET",
    !client && !accessKeyId && "OSS_ACCESS_KEY_ID",
    !client && !accessKeySecret && "OSS_ACCESS_KEY_SECRET"
  ].filter(Boolean);
  if (missing.length || /[\\/]/.test(normalizedBucket)) {
    return {
      kind: "misconfigured",
      enabled: false,
      publicUrlFor() {
        throw storageProblem(503, "storage_not_configured", "Alibaba Cloud OSS is not configured");
      },
      async createSignedUpload() {
        const message = /[\\/]/.test(normalizedBucket)
          ? "OSS_BUCKET must be a bucket name without slashes"
          : `Alibaba Cloud OSS is missing: ${missing.join(", ")}`;
        throw storageProblem(503, "storage_not_configured", message);
      }
    };
  }

  let oss = client;
  if (!oss) {
    let OSS;
    try {
      const require = createRequire(import.meta.url);
      OSS = require("ali-oss");
    } catch (cause) {
      const error = new Error("The ali-oss package is required when OSS storage is configured");
      error.cause = cause;
      throw error;
    }
    oss = new OSS({
      region: normalizedRegion,
      accessKeyId,
      accessKeySecret,
      bucket: normalizedBucket,
      secure: true,
      authorizationV4: true
    });
  }

  return {
    kind: "oss",
    enabled: true,
    publicUrlFor(objectKey) {
      const encodedObjectKey = encodeStoragePath(objectKey);
      const defaultPublicBaseUrl = `https://${normalizedBucket}.${normalizedRegion}.aliyuncs.com`;
      return `${normalizedPublicBaseUrl ?? defaultPublicBaseUrl}/${encodedObjectKey}`;
    },
    async createSignedUpload({ objectKey, contentType = "application/octet-stream" }) {
      const expiresInSeconds = 2 * 60 * 60;
      let uploadUrl;
      try {
        if (typeof oss.signatureUrlV4 === "function") {
          uploadUrl = await oss.signatureUrlV4(
            "PUT",
            expiresInSeconds,
            { headers: { "content-type": contentType } },
            objectKey,
            ["content-type"]
          );
        } else {
          // Compatibility path for injected/older clients. ali-oss 6.23+ uses V4 above.
          uploadUrl = await oss.signatureUrl(objectKey, {
            method: "PUT",
            expires: expiresInSeconds,
            "Content-Type": contentType
          });
        }
      } catch (cause) {
        const error = storageProblem(503, "storage_unavailable", "Could not create an Alibaba Cloud OSS upload URL");
        error.cause = cause;
        throw error;
      }
      if (typeof uploadUrl !== "string" || !uploadUrl.startsWith("https://")) {
        throw storageProblem(502, "invalid_storage_response", "Alibaba Cloud OSS did not return an HTTPS upload URL");
      }
      return {
        storage: "oss",
        objectKey,
        uploadUrl,
        publicUrl: this.publicUrlFor(objectKey),
        headers: { "Content-Type": contentType },
        expiresAt: new Date(now() + expiresInSeconds * 1000).toISOString()
      };
    }
  };
}

function normalizeOssRegion(value) {
  const normalized = String(value ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!normalized) return "";
  if (normalized.endsWith(".aliyuncs.com")) return normalized.split(".")[0];
  return normalized.startsWith("oss-") ? normalized : `oss-${normalized}`;
}

function normalizePublicBaseUrl(value) {
  const normalized = String(value ?? "").trim().replace(/\/+$/, "");
  if (!normalized) return null;
  if (!normalized.startsWith("https://")) {
    throw new Error("OSS_PUBLIC_BASE_URL must use HTTPS");
  }
  return normalized;
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
