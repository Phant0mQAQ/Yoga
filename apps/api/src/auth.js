import crypto from "node:crypto";
import { problem } from "./domain.js";

const DEFAULT_SECRET = "replace-this-secret-in-production";

export function signToken(payload, secret = process.env.APP_SECRET ?? DEFAULT_SECRET) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token, store, secret = process.env.APP_SECRET ?? DEFAULT_SECRET) {
  if (!token) throw problem(401, "missing_token", "Authorization token is required");
  const parts = token.split(".");
  if (parts.length !== 3) throw problem(401, "invalid_token", "Token shape is invalid");
  const [header, payload, signature] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw problem(401, "invalid_token", "Token signature is invalid");
  }
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw problem(401, "expired_token", "Token has expired");
  }
  const session = store.roleSessions.find((item) => item.id === decoded.sid);
  if (!session || session.revokedAt) {
    throw problem(401, "session_revoked", "Session is not active");
  }
  return {
    sessionId: session.id,
    userId: session.userId,
    activeRole: session.activeRole,
    locale: session.locale
  };
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}
