import assert from "node:assert/strict";
import { createStorageUploadProvider } from "../apps/api/src/storage-provider.js";

{
  const requests = [];
  const provider = createStorageUploadProvider({
    supabaseUrl: "https://project.supabase.co/",
    secretKey: "sb_secret_storage_test",
    bucket: "good-vibe-public",
    now: () => 1_800_000_000_000,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        url: "/object/upload/sign/good-vibe-public/content/logo%20new.png?token=signed-token"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  const upload = await provider.createSignedUpload({ objectKey: "content/logo new.png" });
  assert.equal(provider.enabled, true);
  assert.equal(provider.kind, "supabase");
  assert.equal(
    provider.publicUrlFor("avatars/usr_student/profile photo.png"),
    "https://project.supabase.co/storage/v1/object/public/good-vibe-public/avatars/usr_student/profile%20photo.png"
  );
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "https://project.supabase.co/storage/v1/object/upload/sign/good-vibe-public/content/logo%20new.png"
  );
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers.apikey, "sb_secret_storage_test");
  assert.equal(Object.hasOwn(requests[0].options.headers, "Authorization"), false);
  assert.equal(upload.storage, "supabase");
  assert.equal(
    upload.uploadUrl,
    "https://project.supabase.co/storage/v1/object/upload/sign/good-vibe-public/content/logo%20new.png?token=signed-token"
  );
  assert.equal(
    upload.publicUrl,
    "https://project.supabase.co/storage/v1/object/public/good-vibe-public/content/logo%20new.png"
  );
  assert.equal(upload.expiresAt, "2027-01-15T10:00:00.000Z");
}

{
  const provider = createStorageUploadProvider({ bucket: "" });
  assert.equal(provider.enabled, false);
  await assert.rejects(
    provider.createSignedUpload({ objectKey: "content/test.png" }),
    (error) => error?.code === "storage_not_configured" && error?.status === 503
  );
}

{
  let headers;
  const provider = createStorageUploadProvider({
    supabaseUrl: "https://legacy.supabase.co",
    secretKey: "legacy-service-role-jwt",
    bucket: "media",
    fetchImpl: async (_url, options) => {
      headers = options.headers;
      return new Response(JSON.stringify({ url: "/object/upload/sign/media/a.png?token=legacy" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });
  await provider.createSignedUpload({ objectKey: "a.png" });
  assert.equal(headers.Authorization, "Bearer legacy-service-role-jwt");
}

{
  const provider = createStorageUploadProvider({
    supabaseUrl: "https://project.supabase.co",
    secretKey: "sb_secret_storage_test",
    bucket: "bad/name"
  });
  assert.equal(provider.enabled, false);
  await assert.rejects(
    provider.createSignedUpload({ objectKey: "test.png" }),
    (error) => error?.code === "invalid_storage_bucket"
  );
}

{
  let signatureArguments;
  const provider = createStorageUploadProvider({
    ossRegion: "us-west-1",
    ossBucket: "good-vibe-media",
    ossPublicBaseUrl: "https://assets.goodvibe.example",
    ossClient: {
      async signatureUrlV4(...args) {
        signatureArguments = args;
        return "https://good-vibe-media.oss-us-west-1.aliyuncs.com/content/photo.png?signed=true";
      }
    },
    now: () => 1_800_000_000_000
  });
  const upload = await provider.createSignedUpload({
    objectKey: "content/photo.png",
    contentType: "image/png"
  });
  assert.equal(provider.kind, "oss");
  assert.equal(provider.enabled, true);
  assert.equal(
    provider.publicUrlFor("avatars/usr_student/profile photo.png"),
    "https://assets.goodvibe.example/avatars/usr_student/profile%20photo.png"
  );
  assert.deepEqual(signatureArguments, [
    "PUT",
    7200,
    { headers: { "content-type": "image/png" } },
    "content/photo.png",
    ["content-type"]
  ]);
  assert.equal(upload.storage, "oss");
  assert.equal(upload.publicUrl, "https://assets.goodvibe.example/content/photo.png");
  assert.deepEqual(upload.headers, { "Content-Type": "image/png" });
  assert.equal(upload.expiresAt, "2027-01-15T10:00:00.000Z");
}

{
  const provider = createStorageUploadProvider({
    ossRegion: "us-west-1",
    ossBucket: "good-vibe-media"
  });
  assert.equal(provider.kind, "misconfigured");
  await assert.rejects(
    provider.createSignedUpload({ objectKey: "content/test.png" }),
    (error) => error?.code === "storage_not_configured" && /OSS_ACCESS_KEY_ID/.test(error.message)
  );
}

{
  const provider = createStorageUploadProvider({
    ossRegion: "oss-us-west-1",
    ossAccessKeyId: "LTAI5tLocalSignatureTest",
    ossAccessKeySecret: "local-signature-secret",
    ossBucket: "good-vibe-media",
    ossPublicBaseUrl: "https://assets.goodvibe.test",
    now: () => 1_800_000_000_000
  });
  const upload = await provider.createSignedUpload({
    objectKey: "content/sdk-check.png",
    contentType: "image/png"
  });
  assert.equal(provider.kind, "oss");
  assert.match(upload.uploadUrl, /^https:\/\/good-vibe-media\.oss-us-west-1\.aliyuncs\.com\/content\/sdk-check\.png\?/);
  assert.match(upload.uploadUrl, /x-oss-signature=/i);
}

console.log("storage provider tests passed");
