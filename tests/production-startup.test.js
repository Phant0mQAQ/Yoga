import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { getFreePort } from "./test-port.js";

const databasePort = await getFreePort();
const apiPort = await getFreePort();
let stateRow = null;
let databaseReadCount = 0;

const database = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/rest/v1/good_vibe_app_state") return json(res, 404, { message: "not found" });

  if (req.method === "GET") {
    databaseReadCount += 1;
    return json(res, 200, stateRow ? [{ state: stateRow.state, version: stateRow.version }] : []);
  }
  if (req.method === "POST") {
    const body = await readJson(req);
    stateRow = { ...body, version: Number(body.version ?? 1) };
    return json(res, 201, [stateRow]);
  }
  if (req.method === "PATCH") {
    const expectedVersion = Number(url.searchParams.get("version")?.replace("eq.", ""));
    if (!stateRow || stateRow.version !== expectedVersion) return json(res, 200, []);
    stateRow = { ...stateRow, ...await readJson(req) };
    return json(res, 200, [stateRow]);
  }
  return json(res, 405, { message: "method not allowed" });
});

await new Promise((resolve) => database.listen(databasePort, "127.0.0.1", resolve));
let apiServer;

try {
  apiServer = startApi();
  await waitForHealth();

  const demoLogin = await api("/auth/login", {
    method: "POST",
    expectStatus: 401,
    body: {
      email: "admin@example.com",
      password: "GoodVibe@2026",
      role: "admin",
      locale: "en"
    }
  });
  assert.equal(demoLogin.error, "invalid_credentials");

  const adminLogin = await api("/auth/login", {
    method: "POST",
    body: {
      email: "owner@goodvibe.test",
      password: "UniqueProductionPassword!",
      role: "admin",
      locale: "en"
    }
  });
  assert.equal(adminLogin.user.id, "usr_admin");
  assert.equal(stateRow.state.authIdentities.length, 1);

  const readsBeforeCachedRequests = databaseReadCount;
  await Promise.all([
    api("/payments/methods?scope=all"),
    api("/payments/methods?scope=all"),
    api("/payments/methods?scope=all")
  ]);
  assert.equal(
    databaseReadCount,
    readsBeforeCachedRequests,
    "concurrent read requests should reuse the freshly cached store"
  );

  console.log("production startup tests passed");
} finally {
  if (apiServer && apiServer.exitCode === null) {
    apiServer.kill();
    await once(apiServer, "exit");
  }
  await new Promise((resolve) => database.close(resolve));
}

function startApi() {
  return spawn(process.execPath, ["apps/api/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(apiPort),
      APP_BASE_URL: "https://api.goodvibe.test",
      APP_SECRET: "test-secret-with-more-than-32-characters",
      SUPABASE_URL: `http://127.0.0.1:${databasePort}`,
      SUPABASE_SECRET_KEY: "sb_secret_test",
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
      STRIPE_MERCHANT_IDENTIFIER: "merchant.com.goodvibe.pilatesyoga",
      COACH_INVITE_CODE: "test-coach-invite-2026",
      INITIAL_ADMIN_EMAIL: "owner@goodvibe.test",
      INITIAL_ADMIN_PASSWORD: "UniqueProductionPassword!",
      LEGAL_OPERATOR_NAME: "Good Vibe Pilates & Yoga LLC",
      LEGAL_POSTAL_ADDRESS: "123 Test Street, San Francisco, CA 94105",
      PRIVACY_EMAIL: "privacy@goodvibe.test",
      SUPPORT_EMAIL: "support@goodvibe.test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 7000) {
    if (apiServer.exitCode !== null) throw new Error(`Production API exited with ${apiServer.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Production API did not start");
}

async function api(path, { method = "GET", body, expectStatus = 200 } = {}) {
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  assert.equal(response.status, expectStatus, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}
