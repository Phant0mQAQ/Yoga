import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { getFreePort } from "./test-port.js";

const PORT = String(await getFreePort());
const base = `http://localhost:${PORT}/api/v1`;

const server = spawn(process.execPath, ["apps/api/server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForHealth();
  const admin = await loginAs("admin@example.com", "admin");
  const staff = await loginAs("staff@example.com", "staff");

  const dashboard = await api("/admin/dashboard", { token: admin.token });
  assert.equal(typeof dashboard.metrics.members, "number");

  const member = await api("/admin/members/usr_student", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-member-locale",
    body: { locale: "ko" }
  });
  assert.equal(member.locale, "ko");

  const duplicateMember = await api("/admin/members/usr_student", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-member-locale",
    body: { locale: "en" }
  });
  assert.equal(duplicateMember.locale, "ko");

  const forbidden = await api("/admin/dashboard", { token: staff.token, expectStatus: 403 });
  assert.equal(forbidden.error, "forbidden");

  const malformedToken = await api("/admin/dashboard", {
    token: "a.b.c",
    expectStatus: 401
  });
  assert.equal(malformedToken.error, "invalid_token");

  const sheet = await api("/payments/stripe/payment-sheet", {
    method: "POST",
    token: admin.token,
    expectStatus: 201,
    body: { amount: 10000, currency: "KRW", country: "KR", methodCode: "card" }
  });
  assert.ok(sheet.stripe.paymentIntentClientSecret.includes("secret"));

  const student = await loginAs("student@example.com", "student");
  await api("/bookings", {
    method: "POST",
    token: student.token,
    idempotencyKey: "api-test-participant-booking",
    expectStatus: 201,
    body: { courseSessionId: "sess_flow_1", paymentMode: "member_card" }
  });
  const availability = await api("/availability?locale=en");
  const bookedSession = availability.find((session) => session.id === "sess_flow_1");
  assert.ok(bookedSession.participants.some((person) => person.id === "usr_student"));
  assert.equal(bookedSession.participantCount, 1);

  const firstLogout = await api("/auth/logout", {
    method: "POST",
    token: student.token
  });
  assert.equal(firstLogout.ok, true);

  const repeatedLogout = await api("/auth/logout", {
    method: "POST",
    token: student.token
  });
  assert.equal(repeatedLogout.ok, true);

  const protectedAfterLogout = await api("/bookings", {
    token: student.token,
    expectStatus: 401
  });
  assert.equal(protectedAfterLogout.error, "session_revoked");

  console.log("api route tests passed");
} finally {
  server.kill();
}

async function loginAs(identifier, role) {
  return api("/auth/login", {
    method: "POST",
    body: { email: identifier, password: "Yomi@2026", role, locale: "en" }
  });
}

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    try {
      const response = await fetch(`http://localhost:${PORT}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("server did not start");
}

async function api(path, { method = "GET", body, token, idempotencyKey, expectStatus = 200 } = {}) {
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
