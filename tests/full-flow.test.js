import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { getFreePort } from "./test-port.js";

const PORT = String(await getFreePort());
const apiBase = `http://127.0.0.1:${PORT}/api/v1`;
const server = spawn(process.execPath, ["apps/api/server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT,
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SUPABASE_SECRET_KEY: ""
  },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForHealth();

  const home = await api("/home?locale=en");
  assert.ok(home.banners.length > 0);
  assert.ok((await api("/courses")).length > 0);
  assert.equal((await api("/courses/course_flow")).id, "course_flow");
  assert.ok((await api("/coaches")).length > 0);
  assert.equal((await api("/coaches/coach_sora")).id, "coach_sora");
  assert.ok((await api("/availability?locale=en")).length > 0);
  assert.ok((await api("/products")).length > 0);
  assert.ok((await api("/payments/methods?country=KR&currency=KRW")).some((item) => item.code === "kr_card"));

  const student = await login("student");
  const coach = await login("coach");
  const staff = await login("staff");
  const admin = await login("admin");

  assert.equal((await api("/me", { token: student.token })).activeRole, "student");
  assert.equal((await api("/me", { token: coach.token })).activeRole, "coach");
  assert.equal((await api("/me", { token: staff.token })).activeRole, "staff");
  assert.equal((await api("/me", { token: admin.token })).activeRole, "admin");

  const cards = await api("/member-cards", { token: student.token });
  assert.equal(cards.length, 1);
  assert.ok(Array.isArray(await api(`/member-cards/${cards[0].id}/transactions`, { token: student.token })));

  const firstBooking = await api("/bookings", {
    method: "POST",
    token: student.token,
    idempotencyKey: "full-flow-booking-one",
    expectStatus: 201,
    body: { courseSessionId: "sess_flow_1", paymentMode: "member_card" }
  });
  assert.equal(firstBooking.booking.status, "confirmed");
  assert.equal((await api(`/bookings/${firstBooking.booking.id}`, { token: student.token })).id, firstBooking.booking.id);
  assert.ok((await api("/bookings", { token: coach.token })).some((item) => item.id === firstBooking.booking.id));
  assert.ok((await api("/staff/bookings", { token: staff.token })).some((item) => item.id === firstBooking.booking.id));
  assert.ok(Array.isArray(await api("/staff/today", { token: staff.token })));
  assert.ok((await api("/staff/search?query=mia", { token: staff.token })).users.length > 0);

  const checkIn = await api(`/bookings/${firstBooking.booking.id}/check-in`, {
    method: "POST",
    token: staff.token,
    body: { method: "manual" }
  });
  assert.equal(checkIn.booking.status, "checked_in");

  const secondBooking = await api("/bookings", {
    method: "POST",
    token: student.token,
    idempotencyKey: "full-flow-booking-two",
    expectStatus: 201,
    body: { courseSessionId: "sess_private_1", paymentMode: "member_card" }
  });
  const rescheduled = await api(`/bookings/${secondBooking.booking.id}/reschedule`, {
    method: "POST",
    token: student.token,
    body: { nextCourseSessionId: "sess_flow_1" }
  });
  assert.equal(rescheduled.booking.courseSessionId, "sess_flow_1");
  const cancelled = await api(`/bookings/${secondBooking.booking.id}/cancel`, {
    method: "POST",
    token: student.token,
    body: { reason: "full_flow_test" }
  });
  assert.equal(cancelled.booking.status, "cancelled");

  const createdOrder = await api("/orders", {
    method: "POST",
    token: student.token,
    idempotencyKey: "full-flow-order",
    expectStatus: 201,
    body: { items: [{ productId: "prod_mat", quantity: 1 }] }
  });
  assert.equal((await api(`/orders/${createdOrder.order.id}`, { token: student.token })).id, createdOrder.order.id);
  assert.ok((await api("/orders", { token: student.token })).some((item) => item.id === createdOrder.order.id));

  const intent = await api("/payments/stripe/payment-intents", {
    method: "POST",
    token: student.token,
    expectStatus: 201,
    body: { orderId: createdOrder.order.id, country: "KR", currency: "KRW", methodCode: "card" }
  });
  assert.ok(intent.payment.id);
  const sheet = await api("/payments/stripe/payment-sheet", {
    method: "POST",
    token: student.token,
    expectStatus: 201,
    body: { amount: 10000, country: "KR", currency: "KRW", methodCode: "kr_card" }
  });
  assert.ok(sheet.stripe.paymentIntentClientSecret);
  const checkout = await api("/payments/stripe/checkout-sessions", {
    method: "POST",
    token: student.token,
    expectStatus: 201,
    body: {
      amount: 10000,
      country: "KR",
      currency: "KRW",
      methodCode: "kakao_pay",
      successUrl: "yogabooking://payment-return?status=success",
      cancelUrl: "yogabooking://payment-return?status=cancel"
    }
  });
  assert.ok(checkout.payment.id);

  assert.equal(typeof (await api("/admin/dashboard", { token: admin.token })).metrics.members, "number");
  assert.ok((await api("/admin/members", { token: admin.token })).length > 0);
  assert.equal((await api("/admin/members/usr_student", { token: admin.token })).id, "usr_student");
  assert.ok((await api("/admin/member-cards", { token: admin.token })).length > 0);
  assert.ok((await api("/admin/orders", { token: admin.token })).length > 0);
  assert.ok((await api("/admin/payments", { token: admin.token })).length >= 3);

  const createdContent = await api("/admin/content-blocks", {
    method: "POST",
    token: admin.token,
    idempotencyKey: "full-flow-content-create",
    expectStatus: 201,
    body: { id: "full_flow_content", type: "knowledge", title: { en: "Test" }, active: true }
  });
  assert.equal(createdContent.id, "full_flow_content");
  assert.equal((await api("/admin/content-blocks/full_flow_content", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "full-flow-content-update",
    body: { active: false }
  })).active, false);
  assert.equal((await api("/admin/content-blocks/full_flow_content", {
    method: "DELETE",
    token: admin.token,
    idempotencyKey: "full-flow-content-delete"
  })).id, "full_flow_content");

  assert.ok((await api("/admin/uploads/presign", {
    method: "POST",
    token: admin.token,
    idempotencyKey: "full-flow-upload",
    body: { scope: "content", fileName: "test image.jpg" }
  })).uploadUrl);

  await api(`/admin/member-cards/${cards[0].id}/extend`, {
    method: "POST",
    token: admin.token,
    idempotencyKey: "full-flow-card-extend",
    body: { days: 7 }
  });
  await api(`/admin/member-cards/${cards[0].id}/upgrade`, {
    method: "POST",
    token: admin.token,
    idempotencyKey: "full-flow-card-upgrade",
    body: { addCredits: 2 }
  });
  await api(`/admin/member-cards/${cards[0].id}/freeze`, {
    method: "POST",
    token: admin.token,
    idempotencyKey: "full-flow-card-freeze",
    body: {}
  });
  await api(`/admin/member-cards/${cards[0].id}/transfer`, {
    method: "POST",
    token: admin.token,
    idempotencyKey: "full-flow-card-transfer",
    body: { toUserId: "usr_staff" }
  });

  const refund = await api(`/admin/payments/${intent.payment.id}/refunds`, {
    method: "POST",
    token: admin.token,
    idempotencyKey: "full-flow-refund",
    expectStatus: 200,
    body: { reason: "full_flow_test" }
  });
  assert.equal(refund.payment.refundStatus, "refunded");
  assert.ok((await api("/admin/audit-logs", { token: admin.token })).length > 0);

  assert.equal((await api("/admin/dashboard", { token: staff.token, expectStatus: 403 })).error, "forbidden");
  assert.equal((await api("/bookings", { expectStatus: 401 })).error, "unauthorized");

  assert.equal((await api("/auth/logout", { method: "POST", token: student.token })).ok, true);
  assert.equal((await api("/auth/logout", { method: "POST", token: student.token })).ok, true);
  assert.equal((await api("/me", { token: student.token, expectStatus: 401 })).error, "session_revoked");

  console.log("full application flow tests passed");
} finally {
  server.kill();
}

function login(role) {
  return api("/auth/login", {
    method: "POST",
    body: {
      email: `${role}@example.com`,
      password: "Yomi@2026",
      role,
      locale: "en"
    }
  });
}

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 7000) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("full-flow API server did not start");
}

async function api(path, {
  method = "GET",
  body,
  token,
  idempotencyKey,
  expectStatus = 200
} = {}) {
  const response = await fetch(`${apiBase}${path}`, {
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
