import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { getFreePort } from "./test-port.js";

const SUPABASE_PORT = await getFreePort();
const API_PORT = await getFreePort();
let stateRow = null;

const supabase = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/rest/v1/yomi_app_state") {
    return json(res, 404, { message: "not found" });
  }

  if (req.method === "GET") {
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
    const body = await readJson(req);
    stateRow = { ...stateRow, ...body };
    return json(res, 200, [stateRow]);
  }

  return json(res, 405, { message: "method not allowed" });
});

await new Promise((resolve) => supabase.listen(SUPABASE_PORT, "127.0.0.1", resolve));
let apiServer = null;

try {
  apiServer = startApi();
  await waitForHealth();
  const health = await api("/health", { base: `http://127.0.0.1:${API_PORT}` });
  assert.equal(health.database, "supabase");

  const student = await loginStudent();
  await api("/bookings", {
    method: "POST",
    token: student.token,
    idempotencyKey: "supabase-persistence-booking",
    expectStatus: 201,
    body: { courseSessionId: "sess_flow_1", paymentMode: "member_card" }
  });

  await stopApi();
  apiServer = startApi();
  await waitForHealth();

  const restoredStudent = await loginStudent();
  const restoredBookings = await api("/bookings", { token: restoredStudent.token });
  assert.equal(restoredBookings.length, 1);
  assert.equal(restoredBookings[0].courseSessionId, "sess_flow_1");

  console.log("supabase API persistence tests passed");
} finally {
  await stopApi();
  await new Promise((resolve) => supabase.close(resolve));
}

function startApi() {
  return spawn(process.execPath, ["apps/api/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(API_PORT),
      SUPABASE_URL: `http://127.0.0.1:${SUPABASE_PORT}`,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function stopApi() {
  if (!apiServer || apiServer.exitCode !== null) return;
  apiServer.kill();
  await once(apiServer, "exit");
}

async function loginStudent() {
  return api("/auth/login", {
    method: "POST",
    body: {
      email: "student@example.com",
      password: "Yomi@2026",
      role: "student",
      locale: "en"
    }
  });
}

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 7000) {
    try {
      const response = await fetch(`http://127.0.0.1:${API_PORT}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Supabase-backed API did not start");
}

async function api(path, {
  base = `http://127.0.0.1:${API_PORT}/api/v1`,
  method = "GET",
  body,
  token,
  idempotencyKey,
  expectStatus = 200
} = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
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
