import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyStripeEvent,
  BOOKING_STATUS,
  cancelBooking,
  checkInBooking,
  createBooking,
  createOrder,
  createPaymentRecord,
  createSeedStore,
  audit,
  getCurrentUser,
  getPaymentMethods,
  hardenProductionStore,
  id,
  localizeEntity,
  login,
  logout,
  memberCardOperation,
  PAYMENT_STATUS,
  problem,
  requireRole,
  repairKnownTranslations,
  rescheduleBooking,
  ROLES
} from "./src/domain.js";
import { signToken, verifyToken } from "./src/auth.js";
import {
  createStripeCheckoutSession,
  createStripePaymentSheet,
  createStripePaymentIntent,
  verifyStripeWebhook
} from "./src/stripe-provider.js";
import { createStoreRepository, restoreStore } from "./src/store-repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.resolve(__dirname, "../admin");
const mobileDir = path.resolve(__dirname, "../mobile");
assertProductionConfiguration();
const storeRepository = createStoreRepository();
const store = await storeRepository.load(createSeedStore());
const storeNeedsSave = repairKnownTranslations(store);
const productionStoreChanged = hardenProductionStore(store);
if (storeNeedsSave || productionStoreChanged) {
  await storeRepository.save(store);
}
const port = Number(process.env.PORT ?? 8080);

const server = http.createServer(async (req, res) => {
  let rollbackSnapshot = null;
  try {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "yoga-booking-api",
        database: storeRepository.kind,
        time: new Date().toISOString()
      });
      return;
    }

    if (url.pathname === "/" || url.pathname.startsWith("/admin")) {
      await serveAdmin(req, res, url);
      return;
    }

    if (url.pathname.startsWith("/app")) {
      await serveStatic(req, res, url, mobileDir, "/app", "index.html");
      return;
    }

    if (!url.pathname.startsWith("/api/v1")) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    if (storeRepository.enabled && isMutation(req.method)) {
      rollbackSnapshot = structuredClone(store);
      res.yomiDeferJson = true;
    }

    if (url.pathname === "/api/v1/payments/stripe/webhook" && req.method === "POST") {
      const rawBody = await readRawBody(req);
      const event = verifyStripeWebhook(rawBody, req.headers["stripe-signature"]);
      const result = applyStripeEvent(store, event);
      sendJson(res, 200, result);
      await persistAndFlush(res);
      return;
    }

    const body = await readJson(req);
    const isLogoutRequest = req.method === "POST" && url.pathname === "/api/v1/auth/logout";
    const auth = optionalAuth(req, { ignoreInvalid: isLogoutRequest });
    await routeApi(req, res, url, body, auth);
    await persistAndFlush(res);
  } catch (error) {
    if (rollbackSnapshot) restoreStore(store, rollbackSnapshot);
    res.yomiDeferJson = false;
    res.yomiPendingJson = null;
    const status = error.status ?? 500;
    if (!res.headersSent) {
      sendJson(res, status, {
        error: error.code ?? "internal_error",
        message: error.message,
        details: error.stripe
      });
    }
  }
});

server.listen(port, () => {
  console.log(`Yoga booking API listening on http://localhost:${port}`);
  console.log(`Admin UI: http://localhost:${port}/admin`);
  console.log(`Database: ${storeRepository.kind}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

async function routeApi(req, res, url, body, auth) {
  const method = req.method;
  const pathName = url.pathname.replace("/api/v1", "") || "/";
  const segments = pathName.split("/").filter(Boolean);
  const locale = url.searchParams.get("locale") ?? auth?.locale ?? "en";

  if (method === "POST" && pathName === "/auth/login") {
    sendJson(res, 200, login(store, body, signToken));
    return;
  }

  if (method === "POST" && pathName === "/auth/logout") {
    sendJson(res, 200, auth ? logout(store, auth.sessionId) : { ok: true });
    return;
  }

  if (method === "GET" && pathName === "/me") {
    requireAuth(auth);
    sendJson(res, 200, getCurrentUser(store, auth));
    return;
  }

  if (method === "GET" && pathName === "/home") {
    sendJson(res, 200, {
      banners: store.contentBlocks.filter((item) => item.type === "banner" && item.active).map((item) => localizeEntity(item, locale)),
      features: store.contentBlocks.filter((item) => item.type === "feature" && item.active).map((item) => localizeEntity(item, locale)),
      knowledge: store.contentBlocks.filter((item) => item.type === "knowledge" && item.active).map((item) => localizeEntity(item, locale)),
      recommendedCourses: store.courses.map((item) => localizeEntity(item, locale)),
      recommendedCoaches: store.coaches.map((item) => localizeEntity(item, locale)),
      storeRecommendations: store.products.map((item) => localizeEntity(item, locale))
    });
    return;
  }

  if (method === "GET" && pathName === "/courses") {
    sendJson(res, 200, store.courses.map((item) => localizeEntity(item, locale)));
    return;
  }

  if (method === "GET" && segments[0] === "courses" && segments[1]) {
    const course = store.courses.find((item) => item.id === segments[1]);
    if (!course) throw problem(404, "course_not_found", "Course not found");
    sendJson(res, 200, localizeEntity(course, locale));
    return;
  }

  if (method === "GET" && pathName === "/coaches") {
    sendJson(res, 200, store.coaches.map((item) => localizeEntity(item, locale)));
    return;
  }

  if (method === "GET" && segments[0] === "coaches" && segments[1]) {
    const coach = store.coaches.find((item) => item.id === segments[1]);
    if (!coach) throw problem(404, "coach_not_found", "Coach not found");
    sendJson(res, 200, localizeEntity(coach, locale));
    return;
  }

  if (method === "GET" && pathName === "/availability") {
    const coachId = url.searchParams.get("coachId");
    const courseId = url.searchParams.get("courseId");
    const sessions = store.courseSessions
      .filter((session) => !coachId || session.coachId === coachId)
      .filter((session) => !courseId || session.courseId === courseId)
      .filter((session) => session.status === "open")
      .map((session) => ({
        ...session,
        remainingCapacity: session.capacity - session.bookedCount,
        course: localizeEntity(store.courses.find((course) => course.id === session.courseId), locale),
        coach: localizeEntity(store.coaches.find((coach) => coach.id === session.coachId), locale),
        participants: sessionParticipants(session.id),
        participantCount: sessionParticipants(session.id).length
      }));
    sendJson(res, 200, sessions);
    return;
  }

  if (method === "POST" && pathName === "/bookings") {
    requireAuth(auth);
    sendJson(res, 201, createBooking(store, auth, body, req.headers["idempotency-key"]));
    return;
  }

  if (method === "GET" && pathName === "/bookings") {
    requireAuth(auth);
    let bookings = store.bookings;
    if (auth.activeRole === ROLES.STUDENT) bookings = bookings.filter((item) => item.userId === auth.userId);
    if (auth.activeRole === ROLES.COACH) {
      const coach = store.coaches.find((item) => item.userId === auth.userId);
      bookings = bookings.filter((item) => item.coachId === coach?.id);
    }
    sendJson(res, 200, enrichBookings(bookings, locale));
    return;
  }

  if (method === "GET" && segments[0] === "bookings" && segments[1]) {
    requireAuth(auth);
    const booking = store.bookings.find((item) => item.id === segments[1]);
    if (!booking) throw problem(404, "booking_not_found", "Booking not found");
    if (auth.activeRole === ROLES.STUDENT && booking.userId !== auth.userId) {
      throw problem(403, "forbidden", "Cannot access another user's booking");
    }
    sendJson(res, 200, enrichBookings([booking], locale)[0]);
    return;
  }

  if (method === "POST" && segments[0] === "bookings" && segments[2] === "cancel") {
    requireAuth(auth);
    sendJson(res, 200, cancelBooking(store, auth, segments[1], body.reason));
    return;
  }

  if (method === "POST" && segments[0] === "bookings" && segments[2] === "reschedule") {
    requireAuth(auth);
    sendJson(res, 200, rescheduleBooking(store, auth, segments[1], body.nextCourseSessionId));
    return;
  }

  if (method === "POST" && segments[0] === "bookings" && segments[2] === "check-in") {
    requireAuth(auth);
    sendJson(res, 200, checkInBooking(store, auth, segments[1], body.method ?? "manual"));
    return;
  }

  if (method === "GET" && pathName === "/member-cards") {
    requireAuth(auth);
    let cards = store.memberCards;
    if (auth.activeRole === ROLES.STUDENT) cards = cards.filter((card) => card.userId === auth.userId);
    sendJson(res, 200, cards);
    return;
  }

  if (method === "GET" && segments[0] === "member-cards" && segments[2] === "transactions") {
    requireAuth(auth);
    const card = store.memberCards.find((item) => item.id === segments[1]);
    if (!card) throw problem(404, "member_card_not_found", "Member card not found");
    if (auth.activeRole === ROLES.STUDENT && card.userId !== auth.userId) {
      throw problem(403, "forbidden", "Cannot access another user's member card");
    }
    sendJson(res, 200, store.cardTransactions.filter((item) => item.cardId === card.id));
    return;
  }

  if (method === "POST" && segments[0] === "member-cards" && ["freeze", "extend", "transfer", "upgrade"].includes(segments[2])) {
    requireAuth(auth);
    sendJson(res, 200, memberCardOperation(store, auth, segments[1], segments[2], body));
    return;
  }

  if (method === "GET" && pathName === "/products") {
    sendJson(res, 200, store.products.map((item) => localizeEntity(item, locale)));
    return;
  }

  if (method === "POST" && pathName === "/orders") {
    requireAuth(auth);
    sendJson(res, 201, createOrder(store, auth, body, req.headers["idempotency-key"]));
    return;
  }

  if (method === "GET" && pathName === "/orders") {
    requireAuth(auth);
    let orders = store.orders;
    if (auth.activeRole === ROLES.STUDENT) orders = orders.filter((order) => order.userId === auth.userId);
    sendJson(res, 200, orders.map(enrichOrder));
    return;
  }

  if (method === "GET" && segments[0] === "orders" && segments[1]) {
    requireAuth(auth);
    const order = store.orders.find((item) => item.id === segments[1]);
    if (!order) throw problem(404, "order_not_found", "Order not found");
    if (auth.activeRole === ROLES.STUDENT && order.userId !== auth.userId) {
      throw problem(403, "forbidden", "Cannot access another user's order");
    }
    sendJson(res, 200, enrichOrder(order));
    return;
  }

  if (method === "GET" && pathName === "/payments/methods") {
    sendJson(res, 200, getPaymentMethods({
      currency: url.searchParams.get("currency") ?? "HKD",
      country: url.searchParams.get("country") ?? "HK",
      recurring: url.searchParams.get("recurring") === "true"
    }));
    return;
  }

  if (method === "POST" && pathName === "/payments/stripe/payment-intents") {
    requireAuth(auth);
    const order = body.orderId ? store.orders.find((item) => item.id === body.orderId) : null;
    const amount = body.amount ?? order?.totalAmount;
    const currency = body.currency ?? order?.currency ?? "HKD";
    const methodCode = body.methodCode ?? "card";
    const user = store.users.find((item) => item.id === auth.userId);
    const stripeResult = await createStripePaymentIntent({
      amount,
      currency,
      methodCode,
      orderId: body.orderId,
      customerEmail: user?.email,
      returnUrl: body.returnUrl ?? `${baseUrl()}/payments/return`
    });
    const payment = createPaymentRecord(store, auth, {
      orderId: body.orderId,
      amount,
      currency,
      country: body.country ?? "HK",
      methodCode,
      providerPayload: {
        paymentIntentId: stripeResult.id ?? stripeResult.paymentIntentId
      }
    });
    sendJson(res, 201, { payment, stripe: stripeResult });
    return;
  }

  if (method === "POST" && pathName === "/payments/stripe/payment-sheet") {
    requireAuth(auth);
    const order = body.orderId ? store.orders.find((item) => item.id === body.orderId) : null;
    const amount = body.amount ?? order?.totalAmount;
    const currency = body.currency ?? order?.currency ?? "HKD";
    const methodCode = body.methodCode ?? "card";
    const user = store.users.find((item) => item.id === auth.userId);
    const stripeResult = await createStripePaymentSheet({
      amount,
      currency,
      methodCode,
      orderId: body.orderId,
      customerEmail: user?.email,
      merchantIdentifier: body.merchantIdentifier
    });
    const payment = createPaymentRecord(store, auth, {
      orderId: body.orderId,
      amount,
      currency,
      country: body.country ?? "HK",
      methodCode,
      providerPayload: {
        paymentIntentId: stripeResult.paymentIntentId
      }
    });
    sendJson(res, 201, { payment, stripe: stripeResult });
    return;
  }

  if (method === "POST" && pathName === "/payments/stripe/checkout-sessions") {
    requireAuth(auth);
    const order = body.orderId ? store.orders.find((item) => item.id === body.orderId) : null;
    const amount = body.amount ?? order?.totalAmount;
    const currency = body.currency ?? order?.currency ?? "HKD";
    const methodCode = body.methodCode ?? "card";
    const stripeResult = await createStripeCheckoutSession({
      amount,
      currency,
      methodCode,
      orderId: body.orderId,
      productName: body.productName ?? "Yoga booking",
      successUrl: body.successUrl ?? `${baseUrl()}/admin?payment=success`,
      cancelUrl: body.cancelUrl ?? `${baseUrl()}/admin?payment=cancel`
    });
    const payment = createPaymentRecord(store, auth, {
      orderId: body.orderId,
      amount,
      currency,
      country: body.country ?? "HK",
      methodCode,
      providerPayload: {
        checkoutSessionId: stripeResult.id ?? stripeResult.checkoutSessionId
      }
    });
    sendJson(res, 201, { payment, stripe: stripeResult });
    return;
  }

  if (method === "POST" && segments[0] === "payments" && segments[2] === "refunds") {
    requireAuth(auth);
    requireRole(auth, [ROLES.STAFF, ROLES.ADMIN]);
    const payment = store.payments.find((item) => item.id === segments[1]);
    if (!payment) throw problem(404, "payment_not_found", "Payment not found");
    const refund = {
      id: `ref_${Date.now()}`,
      paymentId: payment.id,
      amount: body.amount ?? payment.amount,
      currency: payment.currency,
      status: "succeeded",
      reason: body.reason ?? "requested_by_customer",
      createdAt: new Date().toISOString()
    };
    payment.status = PAYMENT_STATUS.REFUNDED;
    payment.refundStatus = "refunded";
    store.refunds.push(refund);
    sendJson(res, 201, { refund, payment });
    return;
  }

  if (segments[0] === "staff") {
    requireAuth(auth);
    requireRole(auth, [ROLES.STAFF, ROLES.ADMIN]);
    routeStaff(req, res, pathName, url, body, locale);
    return;
  }

  if (segments[0] === "admin") {
    requireAuth(auth);
    requireRole(auth, [ROLES.ADMIN]);
    routeAdmin(req, res, segments.slice(1), body);
    return;
  }

  sendJson(res, 404, { error: "not_found", path: pathName });
}

function routeStaff(req, res, pathName, url, body, locale) {
  if (req.method === "GET" && pathName === "/staff/today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const sessions = store.courseSessions
      .filter((session) => new Date(session.startsAt) >= start && new Date(session.startsAt) < end)
      .map((session) => ({
        ...session,
        course: localizeEntity(store.courses.find((course) => course.id === session.courseId), locale),
        coach: localizeEntity(store.coaches.find((coach) => coach.id === session.coachId), locale),
        bookings: enrichBookings(store.bookings.filter((booking) => booking.courseSessionId === session.id), locale)
      }));
    sendJson(res, 200, sessions);
    return;
  }

  if (req.method === "GET" && pathName === "/staff/bookings") {
    const status = url.searchParams.get("status");
    const bookings = store.bookings.filter((booking) => !status || booking.status === status);
    sendJson(res, 200, enrichBookings(bookings, locale));
    return;
  }

  if (req.method === "GET" && pathName === "/staff/search") {
    const query = (url.searchParams.get("query") ?? "").toLowerCase();
    sendJson(res, 200, {
      users: store.users.filter((user) => user.name.toLowerCase().includes(query) || user.email?.includes(query) || user.phone?.includes(query)).map((user) => ({
        ...user,
        memberCards: store.memberCards.filter((card) => card.userId === user.id),
        orders: store.orders.filter((order) => order.userId === user.id)
      }))
    });
    return;
  }

  throw problem(404, "staff_route_not_found", "Staff route not found");
}

function routeAdmin(req, res, segments, body) {
  const resource = segments[0];
  const idValue = segments[1];
  const subresource = segments[2];

  if (req.method === "GET" && resource === "dashboard") {
    sendJson(res, 200, adminDashboard());
    return;
  }

  if (req.method === "GET" && resource === "members") {
    if (!idValue) {
      sendJson(res, 200, store.users.map((user) => enrichMember(user)));
      return;
    }
    const user = store.users.find((item) => item.id === idValue);
    if (!user) throw problem(404, "member_not_found", "Member not found");
    sendJson(res, 200, enrichMember(user));
    return;
  }

  if (req.method === "PATCH" && resource === "members" && idValue) {
    requireAdminIdempotency(req, "admin.members.patch", () => {
      const user = store.users.find((item) => item.id === idValue);
      if (!user) throw problem(404, "member_not_found", "Member not found");
      Object.assign(user, allowed(body, ["name", "email", "phone", "locale", "roles"]), { updatedAt: new Date().toISOString() });
      audit(store, currentAdminAuth(req), "admin.member.update", user.id, body);
      return user;
    }, res);
    return;
  }

  if (resource === "member-cards" && idValue && ["freeze", "extend", "transfer", "upgrade"].includes(subresource) && req.method === "POST") {
    const auth = currentAdminAuth(req);
    requireAdminIdempotency(req, `admin.member_cards.${subresource}`, () => memberCardOperation(store, auth, idValue, subresource, body), res);
    return;
  }

  if (resource === "payments" && idValue && subresource === "refunds" && req.method === "POST") {
    requireAdminIdempotency(req, "admin.payments.refunds", () => {
      const auth = currentAdminAuth(req);
      const payment = store.payments.find((item) => item.id === idValue);
      if (!payment) throw problem(404, "payment_not_found", "Payment not found");
      const refund = {
        id: id("ref"),
        paymentId: payment.id,
        amount: body.amount ?? payment.amount,
        currency: payment.currency,
        status: "succeeded",
        reason: body.reason ?? "requested_by_admin",
        providerRefundId: null,
        createdAt: new Date().toISOString()
      };
      payment.status = "refunded";
      payment.refundStatus = "refunded";
      store.refunds.push(refund);
      audit(store, auth, "admin.payment.refund", payment.id, { refundId: refund.id, amount: refund.amount });
      return { refund, payment };
    }, res);
    return;
  }

  if (resource === "uploads" && idValue === "presign" && req.method === "POST") {
    requireAdminIdempotency(req, "admin.uploads.presign", () => {
      const objectKey = `${body.scope ?? "admin"}/${Date.now()}-${sanitizeFileName(body.fileName ?? "upload.bin")}`;
      const upload = {
        objectKey,
        uploadUrl: `${baseUrl()}/mock-upload/${encodeURIComponent(objectKey)}`,
        publicUrl: `${baseUrl()}/assets/${encodeURIComponent(objectKey)}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      };
      audit(store, currentAdminAuth(req), "admin.upload.presign", objectKey, upload);
      return upload;
    }, res);
    return;
  }

  if (resource === "audit-logs" && req.method === "GET") {
    sendJson(res, 200, store.auditLogs);
    return;
  }

  const collection = adminCollection(resource);
  if (!collection) throw problem(404, "admin_resource_not_found", "Admin resource not found");

  if (req.method === "GET" && !idValue) {
    sendJson(res, 200, collection);
    return;
  }

  if (req.method === "POST" && !idValue) {
    requireAdminIdempotency(req, `admin.${resource}.create`, () => {
      const entity = {
        id: body.id ?? `${resource}_${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString()
      };
      collection.push(entity);
      audit(store, currentAdminAuth(req), `admin.${resource}.create`, entity.id, body);
      return entity;
    }, res, 201);
    return;
  }

  const index = collection.findIndex((item) => item.id === idValue);
  if (index < 0) throw problem(404, "admin_entity_not_found", "Admin entity not found");

  if (req.method === "GET") {
    sendJson(res, 200, collection[index]);
    return;
  }

  if (req.method === "PATCH") {
    requireAdminIdempotency(req, `admin.${resource}.update`, () => {
      collection[index] = {
        ...collection[index],
        ...body,
        updatedAt: new Date().toISOString()
      };
      audit(store, currentAdminAuth(req), `admin.${resource}.update`, collection[index].id, body);
      return collection[index];
    }, res);
    return;
  }

  if (req.method === "DELETE") {
    requireAdminIdempotency(req, `admin.${resource}.delete`, () => {
      const [deleted] = collection.splice(index, 1);
      audit(store, currentAdminAuth(req), `admin.${resource}.delete`, deleted.id, {});
      return deleted;
    }, res);
    return;
  }

  throw problem(405, "method_not_allowed", "Method not allowed");
}

function adminCollection(resource) {
  const map = {
    users: store.users,
    coaches: store.coaches,
    courses: store.courses,
    "course-sessions": store.courseSessions,
    "membership-plans": store.membershipPlans,
    "member-cards": store.memberCards,
    products: store.products,
    orders: store.orders,
    payments: store.payments,
    reviews: store.reviews,
    "body-metrics": store.bodyMetrics,
    "content-blocks": store.contentBlocks,
    "audit-logs": store.auditLogs
  };
  return map[resource];
}

function adminDashboard() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const todaySessions = store.courseSessions.filter((session) => {
    const startsAt = new Date(session.startsAt);
    return startsAt >= todayStart && startsAt < todayEnd;
  });
  return {
    metrics: {
      members: store.users.filter((user) => user.roles.includes(ROLES.STUDENT)).length,
      coaches: store.coaches.length,
      courses: store.courses.length,
      bookings: store.bookings.length,
      orders: store.orders.length,
      payments: store.payments.length
    },
    todaySessions,
    pending: {
      pendingPaymentBookings: store.bookings.filter((booking) => booking.status === BOOKING_STATUS.PENDING_PAYMENT).length,
      lowStockProducts: store.products.filter((product) => product.stock <= 3).length,
      expiringCards: store.memberCards.filter((card) => new Date(card.expiresAt).getTime() < Date.now() + 14 * 24 * 60 * 60 * 1000).length
    }
  };
}

function enrichMember(user) {
  return {
    ...user,
    memberCards: store.memberCards.filter((card) => card.userId === user.id),
    bookings: store.bookings.filter((booking) => booking.userId === user.id),
    orders: store.orders.filter((order) => order.userId === user.id),
    reviews: store.reviews.filter((review) => review.userId === user.id),
    bodyMetrics: store.bodyMetrics.filter((metric) => metric.userId === user.id)
  };
}

function requireAdminIdempotency(req, scope, handler, res, status = 200) {
  const key = req.headers["idempotency-key"];
  if (!key) throw problem(400, "missing_idempotency_key", "Idempotency-Key header is required");
  const existing = store.idempotencyRecords.find((record) => record.key === key && record.scope === scope);
  if (existing) {
    sendJson(res, status, existing.response);
    return;
  }
  const response = handler();
  store.idempotencyRecords.push({
    id: id("idem"),
    key,
    scope,
    response,
    createdAt: new Date().toISOString()
  });
  sendJson(res, status, response);
}

function currentAdminAuth(req) {
  return verifyToken(req.headers.authorization.match(/^Bearer\s+(.+)$/i)[1], store);
}

function allowed(source, keys) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => keys.includes(key)));
}

function sanitizeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function enrichBookings(bookings, locale) {
  return bookings.map((booking) => ({
    ...booking,
    user: store.users.find((user) => user.id === booking.userId),
    course: localizeEntity(store.courses.find((course) => course.id === booking.courseId), locale),
    coach: localizeEntity(store.coaches.find((coach) => coach.id === booking.coachId), locale)
  }));
}

function sessionParticipants(courseSessionId) {
  return store.bookings
    .filter((booking) => booking.courseSessionId === courseSessionId)
    .filter((booking) => booking.status !== BOOKING_STATUS.CANCELLED)
    .map((booking) => {
      const user = store.users.find((item) => item.id === booking.userId);
      return publicParticipant(user, booking);
    })
    .filter(Boolean);
}

function publicParticipant(user, booking) {
  if (!user) return null;
  return {
    id: user.id,
    bookingId: booking.id,
    name: user.name,
    initials: initialsFor(user.name),
    avatarUrl: user.avatarUrl ?? null,
    color: avatarColor(user.id),
    status: booking.status
  };
}

function initialsFor(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarColor(value) {
  const palette = ["#9f1715", "#28695f", "#486b8a", "#8a5d2c", "#7b4c8f", "#4f7b52", "#b45f5f", "#57708f"];
  const hash = String(value).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function enrichOrder(order) {
  return {
    ...order,
    items: store.orderItems.filter((item) => item.orderId === order.id),
    payment: store.payments.find((payment) => payment.id === order.paymentId) ?? null
  };
}

function requireAuth(auth) {
  if (!auth) throw problem(401, "unauthorized", "Authentication is required");
}

function optionalAuth(req, { ignoreInvalid = false } = {}) {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return verifyToken(match[1], store);
  } catch (error) {
    if (ignoreInvalid && error.status === 401) return null;
    throw error;
  }
}

async function readJson(req) {
  if (!["POST", "PATCH", "PUT"].includes(req.method)) return {};
  const raw = await readRawBody(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(problem(413, "payload_too_large", "Payload too large"));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

async function serveAdmin(req, res, url) {
  let filePath = url.pathname === "/" || url.pathname === "/admin"
    ? path.join(adminDir, "index.html")
    : path.join(adminDir, url.pathname.replace("/admin/", ""));
  if (!isInsideDirectory(adminDir, filePath)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "asset_not_found" });
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": contentTypeFor(ext) });
  fs.createReadStream(filePath).pipe(res);
}

async function serveStatic(req, res, url, rootDir, prefix, indexName) {
  const relativePath = url.pathname === prefix ? indexName : url.pathname.replace(`${prefix}/`, "");
  const filePath = path.join(rootDir, relativePath);
  if (!isInsideDirectory(rootDir, filePath)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "asset_not_found" });
    return;
  }
  res.writeHead(200, { "Content-Type": contentTypeFor(path.extname(filePath)) });
  fs.createReadStream(filePath).pipe(res);
}

function contentTypeFor(ext) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json; charset=utf-8"
  }[ext] ?? "application/octet-stream";
}

function sendJson(res, status, payload) {
  if (res.yomiDeferJson) {
    res.yomiPendingJson = { status, payload };
    return;
  }
  writeJson(res, status, payload);
}

function writeJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function persistAndFlush(res) {
  const pending = res.yomiPendingJson;
  if (!pending) return;
  if (pending.status < 400) await storeRepository.save(store);
  res.yomiDeferJson = false;
  res.yomiPendingJson = null;
  writeJson(res, pending.status, pending.payload);
}

function isMutation(method) {
  return ["POST", "PATCH", "PUT", "DELETE"].includes(method);
}

function setCors(req, res) {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowedOrigins.length) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Idempotency-Key,Stripe-Signature");
}

function baseUrl() {
  return process.env.APP_BASE_URL
    ?? process.env.RENDER_EXTERNAL_URL
    ?? `http://localhost:${port}`;
}

function isInsideDirectory(rootDir, candidate) {
  const relative = path.relative(rootDir, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertProductionConfiguration() {
  if (process.env.NODE_ENV !== "production") return;

  const required = [
    "APP_BASE_URL",
    "APP_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_MERCHANT_IDENTIFIER",
    "INITIAL_ADMIN_EMAIL",
    "INITIAL_ADMIN_PASSWORD"
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  }
  if (!process.env.APP_BASE_URL.startsWith("https://")) {
    throw new Error("APP_BASE_URL must use HTTPS in production");
  }
  if (process.env.APP_SECRET.length < 32) {
    throw new Error("APP_SECRET must contain at least 32 characters in production");
  }
  if (process.env.INITIAL_ADMIN_PASSWORD === "Yomi@2026" || process.env.INITIAL_ADMIN_PASSWORD.length < 12) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be unique and contain at least 12 characters");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.INITIAL_ADMIN_EMAIL)) {
    throw new Error("INITIAL_ADMIN_EMAIL must be a valid email address");
  }
}
