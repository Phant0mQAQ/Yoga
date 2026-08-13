import { handleAsNodeRequest } from "cloudflare:node";
import { env } from "cloudflare:workers";

globalThis.__GOOD_VIBE_D1__ = env.DB;
globalThis.__GOOD_VIBE_MEDIA_BUCKET__ = env.MEDIA;
globalThis.__GOOD_VIBE_FIREBASE_WEB_API_KEY__ = env.FIREBASE_WEB_API_KEY;
globalThis.__GOOD_VIBE_COACH_INVITE_CODE__ = env.COACH_INVITE_CODE;
await import("../../apps/api/server.js");

const NODE_SERVER_PORT = 8080;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.redirect(new URL("/admin", url), 302);
    }

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return fetchAsset(request, "/admin/index.html");
    }

    if (url.pathname === "/app" || url.pathname === "/app/") {
      return fetchAsset(request, "/app/index.html");
    }

    if (url.pathname.startsWith("/assets/") && ["GET", "HEAD"].includes(request.method)) {
      return fetchMedia(request, url);
    }

    if (url.pathname.startsWith("/admin/")) {
      return env.ASSETS.fetch(request);
    }

    return handleAsNodeRequest(NODE_SERVER_PORT, request);
  }
};

function fetchAsset(request, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return env.ASSETS.fetch(new Request(assetUrl, request));
}

async function fetchMedia(request, url) {
  let objectKey;
  try {
    objectKey = decodeURIComponent(url.pathname.slice("/assets/".length));
  } catch {
    return new Response("Invalid media path", { status: 400 });
  }
  if (!isAllowedMediaObjectKey(objectKey)) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.MEDIA.get(objectKey);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Cache-Control": "public, max-age=31536000, immutable",
    "ETag": object.httpEtag,
    "X-Content-Type-Options": "nosniff"
  });
  object.writeHttpMetadata(headers);
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

function isAllowedMediaObjectKey(objectKey) {
  if (objectKey.includes("..") || objectKey.includes("\\") || objectKey.includes("\0")) return false;
  return ["avatars/", "courses/", "content/"].some((prefix) => objectKey.startsWith(prefix));
}
