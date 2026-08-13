import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { getFreePort } from "./test-port.js";

const PORT = String(await getFreePort());
const base = `http://localhost:${PORT}/api/v1`;

const server = spawn(process.execPath, ["apps/api/server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT,
    NODE_ENV: "test",
    EMAIL_DELIVERY_MODE: "console",
    COACH_INVITE_CODE: "test-coach-invite-2026",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: ""
  },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForHealth();
  for (const route of ["/app/", "/admin/"]) {
    const staticResponse = await fetch(`http://localhost:${PORT}${route}`);
    assert.equal(staticResponse.status, 200, `${route} should serve its index document`);
    assert.match(staticResponse.headers.get("content-type"), /^text\/html/);
    assert.ok((await staticResponse.text()).includes("<!doctype html>"));
  }
  assert.equal((await fetch(`http://localhost:${PORT}/health`)).status, 200);

  const paymentCatalogResponse = await fetch(`${base}/payments/methods?scope=all`);
  assert.equal(paymentCatalogResponse.status, 200);
  assert.deepEqual(
    (await paymentCatalogResponse.json()).map((method) => method.code),
    ["card", "paypal", "alipay", "wechat_pay", "kakao_pay", "naver_pay", "samsung_pay", "payco"]
  );

  const paymentReturn = await fetch(`http://localhost:${PORT}/payments/return?status=success&locale=zh-Hans&session_id=cs_test_bridge`);
  assert.equal(paymentReturn.status, 200);
  assert.match(paymentReturn.headers.get("content-type"), /^text\/html/);
  assert.equal(paymentReturn.headers.get("cache-control"), "no-store");
  const paymentReturnHtml = await paymentReturn.text();
  assert.match(paymentReturnHtml, /<html lang="zh-Hans">/);
  assert.match(paymentReturnHtml, /goodvibe:\/\/payment-return\?status=success(?:&amp;|&)locale=zh-Hans(?:&amp;|&)session_id=cs_test_bridge/);
  assert.match(paymentReturnHtml, /应用将从服务器刷新最终确认状态/);

  const hostileQuery = new URLSearchParams({
    status: "unknown",
    locale: "<script>alert(1)</script>",
    session_id: '\"><img src=x onerror=alert(1)>'
  });
  const hostileReturn = await fetch(`http://localhost:${PORT}/payments/return?${hostileQuery}`);
  const hostileHtml = await hostileReturn.text();
  assert.equal(hostileReturn.status, 200);
  assert.match(hostileHtml, /<html lang="en">/);
  assert.match(hostileHtml, /goodvibe:\/\/payment-return\?status=pending(?:&amp;|&)locale=en/);
  assert.ok(!hostileHtml.includes('<img src=x onerror=alert(1)>'));
  assert.ok(!hostileHtml.includes('<script>alert(1)</script>'));

  const uploadPreflight = await fetch(`http://localhost:${PORT}/mock-upload/preflight`, {
    method: "OPTIONS",
    headers: { Origin: "https://admin.example.test" }
  });
  assert.equal(uploadPreflight.status, 204);
  assert.ok(uploadPreflight.headers.get("access-control-allow-methods").split(",").includes("PUT"));

  const malformedResponse = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{"
  });
  assert.equal(malformedResponse.status, 400);
  assert.equal((await malformedResponse.json()).error, "invalid_json");

  const registered = await api("/auth/register", {
    method: "POST",
    expectStatus: 201,
    body: {
      name: "Shared Mobile Member",
      email: "shared.member@example.com",
      password: "SharedPass2026",
      role: "student",
      locale: "zh-Hans"
    }
  });
  assert.equal(registered.email, "shared.member@example.com");
  assert.equal(registered.requiresVerification, true);
  assert.equal((await api("/auth/login", {
    method: "POST",
    expectStatus: 403,
    body: {
      identifier: "shared.member@example.com",
      password: "SharedPass2026",
      role: "student",
      locale: "en"
    }
  })).error, "email_not_verified");
  assert.equal((await api("/auth/register", {
    method: "POST",
    expectStatus: 403,
    body: {
      name: "Unsafe Admin",
      email: "unsafe.admin@example.com",
      password: "SharedPass2026",
      role: "admin",
      locale: "en"
    }
  })).error, "role_registration_restricted");
  assert.equal((await api("/auth/register", {
    method: "POST",
    expectStatus: 403,
    body: {
      name: "Uninvited Coach",
      email: "uninvited.coach@example.com",
      password: "SharedPass2026",
      role: "coach",
      inviteCode: "wrong-code",
      locale: "en"
    }
  })).error, "invalid_coach_invite_code");
  const invitedCoachRegistration = await api("/auth/register", {
    method: "POST",
    expectStatus: 201,
    body: {
      name: "Invited Coach",
      email: "invited.coach@example.com",
      password: "SharedPass2026",
      role: "coach",
      inviteCode: "test-coach-invite-2026",
      locale: "en"
    }
  });
  assert.equal(invitedCoachRegistration.email, "invited.coach@example.com");

  const admin = await loginAs("admin@example.com", "admin");
  const staff = await loginAs("staff@example.com", "staff");
  const coach = await loginAs("coach@example.com", "coach");

  assert.equal((await api("/member-cards", { token: coach.token, expectStatus: 403 })).error, "forbidden");
  assert.equal((await api("/orders", { token: coach.token, expectStatus: 403 })).error, "forbidden");

  const dashboard = await api("/admin/dashboard", { token: admin.token });
  assert.equal(typeof dashboard.metrics.members, "number");

  const courseImageUrl = "https://cdn.example.com/courses/signature-flow.jpg";
  const createdCourse = await api("/admin/courses", {
    method: "POST",
    token: admin.token,
    idempotencyKey: "api-test-course-image",
    expectStatus: 201,
    body: {
      id: "course_with_image",
      title: { en: "Signature Flow" },
      description: { en: "A course with a configured cover image." },
      imageUrl: courseImageUrl,
      durationMinutes: 60,
      priceAmount: 3800,
      currency: "USD",
      capacity: 8,
      memberCardDeductCount: 1,
      tags: []
    }
  });
  assert.equal(createdCourse.imageUrl, courseImageUrl);
  assert.equal(createdCourse.active, true);
  assert.equal((await api("/courses?locale=en")).find((course) => course.id === createdCourse.id)?.imageUrl, courseImageUrl);
  await api(`/admin/courses/${createdCourse.id}`, {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-course-hide",
    body: { active: false }
  });
  assert.equal((await api("/courses?locale=en")).some((course) => course.id === createdCourse.id), false);
  assert.equal(
    (await api("/home?locale=en")).recommendedCourses.some((course) => course.id === createdCourse.id),
    false
  );

  const sessionStartsAt = new Date(Date.now() + 3 * 86_400_000);
  const createdSession = await api("/admin/course-sessions", {
    method: "POST",
    token: admin.token,
    idempotencyKey: "api-test-session-default-count",
    expectStatus: 201,
    body: {
      id: "sess_admin_created",
      courseId: "course_flow",
      coachId: "coach_sora",
      startsAt: sessionStartsAt.toISOString(),
      endsAt: new Date(sessionStartsAt.getTime() + 3_600_000).toISOString(),
      capacity: 3
    }
  });
  assert.equal(createdSession.bookedCount, 0);
  assert.equal(createdSession.status, "open");
  const createdAvailability = (await api("/availability?locale=en"))
    .find((session) => session.id === createdSession.id);
  assert.equal(createdAvailability.remainingCapacity, 3);
  const pastStart = new Date(Date.now() - 7_200_000);
  const closedPastSession = await api(`/admin/course-sessions/${createdSession.id}`, {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-session-auto-close",
    body: {
      startsAt: pastStart.toISOString(),
      endsAt: new Date(pastStart.getTime() + 3_600_000).toISOString(),
      status: "open"
    }
  });
  assert.equal(closedPastSession.status, "closed");
  assert.equal(
    (await api("/availability?locale=en")).some((session) => session.id === createdSession.id),
    false
  );

  const invalidSession = await api("/admin/course-sessions", {
    method: "POST",
    token: admin.token,
    idempotencyKey: "api-test-session-negative-capacity",
    expectStatus: 400,
    body: {
      courseId: "course_flow",
      coachId: "coach_sora",
      startsAt: sessionStartsAt.toISOString(),
      endsAt: new Date(sessionStartsAt.getTime() + 3_600_000).toISOString(),
      capacity: -1,
      status: "open"
    }
  });
  assert.equal(invalidSession.error, "invalid_capacity");

  const orphanSession = await api("/admin/course-sessions", {
    method: "POST",
    token: admin.token,
    idempotencyKey: "api-test-session-missing-course",
    expectStatus: 404,
    body: {
      courseId: "course_missing",
      coachId: "coach_sora",
      startsAt: sessionStartsAt.toISOString(),
      endsAt: new Date(sessionStartsAt.getTime() + 3_600_000).toISOString(),
      capacity: 3,
      status: "open"
    }
  });
  assert.equal(orphanSession.error, "course_not_found");

  const reversedSession = await api("/admin/course-sessions", {
    method: "POST",
    token: admin.token,
    idempotencyKey: "api-test-session-reversed-time",
    expectStatus: 400,
    body: {
      courseId: "course_flow",
      coachId: "coach_sora",
      startsAt: sessionStartsAt.toISOString(),
      endsAt: new Date(sessionStartsAt.getTime() - 3_600_000).toISOString(),
      capacity: 3,
      status: "open"
    }
  });
  assert.equal(reversedSession.error, "invalid_session_time");

  const upload = await api("/admin/uploads/presign", {
    method: "POST",
    token: admin.token,
    idempotencyKey: "api-test-upload",
    body: { scope: "content", fileName: "api-test.txt" }
  });
  const uploadResponse = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: "Good Vibe upload"
  });
  assert.equal(uploadResponse.status, 204);
  const publicUpload = await fetch(upload.publicUrl);
  assert.equal(publicUpload.status, 200);
  assert.equal(await publicUpload.text(), "Good Vibe upload");

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

  const invalidRoles = await api("/admin/members/usr_staff", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-invalid-roles",
    expectStatus: 400,
    body: { roles: ["staff", "owner"] }
  });
  assert.equal(invalidRoles.error, "invalid_roles");
  const emptyRoles = await api("/admin/members/usr_staff", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-empty-roles",
    expectStatus: 400,
    body: { roles: [] }
  });
  assert.equal(emptyRoles.error, "invalid_roles");
  const normalizedRoles = await api("/admin/members/usr_staff", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-normalize-roles",
    body: { roles: ["staff", "staff"] }
  });
  assert.deepEqual(normalizedRoles.roles, ["staff"]);
  const extraAdminGrant = await api("/admin/members/usr_staff", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-fixed-admin-only",
    expectStatus: 409,
    body: { roles: ["staff", "admin"] }
  });
  assert.equal(extraAdminGrant.error, "fixed_admin_only");
  const fixedAdminEmailChange = await api("/admin/members/usr_admin", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-fixed-admin-email",
    expectStatus: 409,
    body: { email: "another.admin@example.com" }
  });
  assert.equal(fixedAdminEmailChange.error, "fixed_admin_identity");
  const lastAdminRemoval = await api("/admin/members/usr_admin", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-last-admin",
    expectStatus: 409,
    body: { roles: ["staff"] }
  });
  assert.equal(lastAdminRemoval.error, "last_admin_required");

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
    idempotencyKey: "api-test-payment-sheet",
    expectStatus: 201,
    body: { amount: 10000, currency: "KRW", country: "KR", methodCode: "card" }
  });
  assert.ok(sheet.stripe.paymentIntentClientSecret.includes("secret"));
  const checkout = await api("/payments/stripe/checkout-sessions", {
    method: "POST",
    token: admin.token,
    idempotencyKey: "api-test-standalone-checkout",
    expectStatus: 201,
    body: {
      amount: 12000,
      currency: "KRW",
      country: "KR",
      methodCode: "card",
      successUrl: "goodvibe://untrusted-return?status=success",
      cancelUrl: "goodvibe://untrusted-return?status=cancel"
    }
  });
  const checkoutReturnUrl = new URL(checkout.stripe.url);
  assert.equal(checkoutReturnUrl.origin, `http://localhost:${PORT}`);
  assert.equal(checkoutReturnUrl.pathname, "/payments/return");
  assert.equal(checkoutReturnUrl.searchParams.get("status"), "success");
  assert.equal(checkoutReturnUrl.searchParams.get("locale"), admin.user.locale);
  assert.ok(checkoutReturnUrl.searchParams.get("session_id").startsWith("cs_mock_"));

  await api("/payments/stripe/webhook", {
    method: "POST",
    body: {
      id: "evt_api_sheet_succeeded",
      type: "payment_intent.succeeded",
      data: { object: { id: sheet.payment.stripePaymentIntentId, latest_charge: "ch_api_sheet" } }
    }
  });
  await api(`/admin/payments/${sheet.payment.id}/refunds`, {
    method: "POST",
    token: admin.token,
    idempotencyKey: "api-test-partial-refund",
    body: { amount: 4000, reason: "requested_by_customer" }
  });
  const adminPayments = await api("/admin/payments", { token: admin.token });
  const partiallyRefundedPayment = adminPayments.find((payment) => payment.id === sheet.payment.id);
  assert.equal(partiallyRefundedPayment.refundedAmount, 4000);
  assert.equal(partiallyRefundedPayment.refundableAmount, 6000);
  assert.equal(Object.hasOwn(partiallyRefundedPayment, "refunds"), false);
  assert.equal(Object.hasOwn(
    adminPayments.find((payment) => payment.id === checkout.payment.id),
    "stripeCheckoutUrl"
  ), false);

  const student = await loginAs("student@example.com", "student");
  assert.equal((await api("/me", { token: student.token })).user.avatarUrl, null);
  assert.equal((await api("/me/avatar-upload", {
    method: "POST",
    token: student.token,
    expectStatus: 400,
    body: { fileName: "avatar.txt", contentType: "text/plain", fileSize: 12 }
  })).error, "invalid_avatar_type");
  const avatarUpload = await api("/me/avatar-upload", {
    method: "POST",
    token: student.token,
    body: { fileName: "profile.png", contentType: "image/png", fileSize: 7 }
  });
  assert.match(avatarUpload.objectKey, /^avatars\/usr_student\//);
  assert.equal((await fetch(avatarUpload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: "PNGDATA"
  })).status, 204);
  const avatarUser = await api("/me/avatar", {
    method: "PATCH",
    token: student.token,
    body: { objectKey: avatarUpload.objectKey }
  });
  assert.equal(avatarUser.avatarUrl, avatarUpload.publicUrl);
  assert.equal((await api("/me", { token: student.token })).user.avatarUrl, avatarUpload.publicUrl);
  assert.equal((await api("/me/avatar", {
    method: "PATCH",
    token: student.token,
    expectStatus: 400,
    body: { objectKey: "avatars/usr_admin/stolen.png" }
  })).error, "invalid_avatar_object");
  assert.equal((await api("/me/avatar", {
    method: "PATCH",
    token: student.token,
    expectStatus: 409,
    body: { objectKey: "avatars/usr_student/not-uploaded.png" }
  })).error, "avatar_upload_incomplete");
  const missingPaymentKey = await api("/payments/stripe/payment-sheet", {
    method: "POST",
    token: student.token,
    expectStatus: 400,
    body: { amount: 10000, currency: "KRW", country: "KR", methodCode: "card" }
  });
  assert.equal(missingPaymentKey.error, "missing_idempotency_key");
  await api("/bookings", {
    method: "POST",
    token: student.token,
    idempotencyKey: "api-test-participant-booking",
    expectStatus: 201,
    body: { courseSessionId: "sess_flow_1", paymentMode: "member_card" }
  });
  const duplicateBooking = await api("/bookings", {
    method: "POST",
    token: student.token,
    idempotencyKey: "api-test-participant-booking-duplicate",
    expectStatus: 409,
    body: { courseSessionId: "sess_flow_1", paymentMode: "member_card" }
  });
  assert.equal(duplicateBooking.error, "duplicate_booking");
  const availability = await api("/availability?locale=en");
  const bookedSession = availability.find((session) => session.id === "sess_flow_1");
  assert.equal(
    bookedSession.participants.find((person) => person.id === "usr_student").avatarUrl,
    avatarUpload.publicUrl
  );
  assert.equal(bookedSession.participantCount, 1);

  const order = await api("/orders", {
    method: "POST",
    token: student.token,
    idempotencyKey: "api-test-payment-order",
    expectStatus: 201,
    body: { items: [{ productId: "prod_mat", quantity: 1 }] }
  });
  const mismatchedPayment = await api("/payments/stripe/payment-intents", {
    method: "POST",
    token: student.token,
    idempotencyKey: "api-test-mismatched-payment",
    expectStatus: 409,
    body: {
      orderId: order.order.id,
      amount: 1,
      currency: order.order.currency,
      country: "KR",
      methodCode: "card"
    }
  });
  assert.equal(mismatchedPayment.error, "payment_amount_mismatch");

  const checkoutBody = {
    orderId: order.order.id,
    currency: order.order.currency,
    country: "KR",
    methodCode: "card"
  };
  const [concurrentCheckoutA, concurrentCheckoutB] = await Promise.all([
    api("/payments/stripe/checkout-sessions", {
      method: "POST",
      token: student.token,
      idempotencyKey: "api-test-concurrent-checkout",
      expectStatus: 201,
      body: checkoutBody
    }),
    api("/payments/stripe/checkout-sessions", {
      method: "POST",
      token: student.token,
      idempotencyKey: "api-test-concurrent-checkout",
      expectStatus: 201,
      body: checkoutBody
    })
  ]);
  assert.equal(concurrentCheckoutA.payment.id, concurrentCheckoutB.payment.id);
  assert.equal(concurrentCheckoutA.stripe.url, concurrentCheckoutB.stripe.url);

  const differentKeyRetry = await api("/payments/stripe/checkout-sessions", {
    method: "POST",
    token: student.token,
    idempotencyKey: "api-test-checkout-different-key",
    expectStatus: 201,
    body: checkoutBody
  });
  assert.equal(differentKeyRetry.payment.id, concurrentCheckoutA.payment.id);
  assert.equal(differentKeyRetry.stripe.url, concurrentCheckoutA.stripe.url);
  assert.equal(differentKeyRetry.stripe.reused, true);

  const conflictingFlow = await api("/payments/stripe/payment-sheet", {
    method: "POST",
    token: student.token,
    idempotencyKey: "api-test-conflicting-payment-flow",
    expectStatus: 409,
    body: checkoutBody
  });
  assert.equal(conflictingFlow.error, "order_payment_in_progress");
  assert.equal(conflictingFlow.details.paymentId, concurrentCheckoutA.payment.id);

  await api(`/admin/payments/${concurrentCheckoutA.payment.id}`, {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-expire-checkout",
    body: { stripeCheckoutExpiresAt: new Date(Date.now() - 60_000).toISOString() }
  });
  const expiredCheckoutRetry = await api("/payments/stripe/checkout-sessions", {
    method: "POST",
    token: student.token,
    idempotencyKey: "api-test-renew-expired-checkout",
    expectStatus: 409,
    body: checkoutBody
  });
  assert.equal(expiredCheckoutRetry.error, "order_not_payable");
  const expiredOrder = await api(`/orders/${order.order.id}`, { token: student.token });
  assert.equal(expiredOrder.status, "payment_expired");
  const orderPayments = (await api("/admin/payments", { token: admin.token }))
    .filter((payment) => payment.orderId === order.order.id);
  assert.equal(orderPayments.length, 1);
  assert.equal(orderPayments.filter((payment) => payment.status === "failed").length, 1);
  const productsAfterExpiry = await api("/products");
  assert.equal(productsAfterExpiry.find((product) => product.id === "prod_mat").stock, 20);
  await api("/admin/products/prod_mat", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-product-hide",
    body: { active: false }
  });
  assert.equal((await api("/products")).some((product) => product.id === "prod_mat"), false);
  assert.equal(
    (await api("/home?locale=en")).storeRecommendations.some((product) => product.id === "prod_mat"),
    false
  );
  assert.equal((await api("/orders", {
    method: "POST",
    token: student.token,
    idempotencyKey: "api-test-inactive-product-order",
    expectStatus: 409,
    body: { items: [{ productId: "prod_mat", quantity: 1 }] }
  })).error, "product_inactive");

  const updatedEmail = await api("/admin/members/usr_student", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-member-email",
    body: { email: "mia.updated@example.com" }
  });
  assert.equal(updatedEmail.email, "mia.updated@example.com");
  assert.equal((await loginAs("mia.updated@example.com", "student")).user.id, "usr_student");
  const oldEmailLogin = await api("/auth/login", {
    method: "POST",
    expectStatus: 401,
    body: { email: "student@example.com", password: "GoodVibe@2026", role: "student", locale: "en" }
  });
  assert.equal(oldEmailLogin.error, "invalid_credentials");

  await api("/admin/members/usr_student", {
    method: "PATCH",
    token: admin.token,
    idempotencyKey: "api-test-revoke-student-role",
    body: { roles: ["staff"] }
  });
  const protectedAfterRoleRemoval = await api("/bookings", {
    token: student.token,
    expectStatus: 401
  });
  assert.equal(protectedAfterRoleRemoval.error, "session_revoked");

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
    body: { email: identifier, password: "GoodVibe@2026", role, locale: "en" }
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
