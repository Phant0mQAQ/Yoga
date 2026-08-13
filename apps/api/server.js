import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyStripeEvent,
  BOOKING_STATUS,
  cancelBooking,
  checkInBooking,
  createBooking,
  createPrivacyRequest,
  discardPendingRegistration,
  createOrder,
  createPaymentRecord,
  createSeedStore,
  audit,
  byIdRequired,
  getCurrentUser,
  getPaymentMethods,
  exportPrivacyData,
  enforceFixedAdminAccount,
  effectiveCourseSessionStatus,
  FIXED_ADMIN_USER_ID,
  hardenProductionStore,
  id,
  localizeEntity,
  login,
  loginWithFirebaseUser,
  logout,
  memberCardOperation,
  requestMembershipCancellation,
  normalizeMemberCardStatus,
  normalizeIdentity,
  prepareRefund,
  prepareFirebaseRegistration,
  problem,
  recordRefund,
  releasePendingOrderResources,
  resendEmailVerification,
  requireRole,
  repairKnownTranslations,
  repairOperationalState,
  register,
  registerFirebaseUser,
  rescheduleBooking,
  ROLES,
  validatePaymentRequest,
  verifyEmailRegistration,
  deleteAccount
} from "./src/domain.js";
import { signToken, verifyToken } from "./src/auth.js";
import { createEmailProvider } from "./src/email-provider.js";
import { createFirebaseAuthProvider } from "./src/firebase-auth-provider.js";
import {
  createStripeCheckoutSession,
  createStripePaymentSheet,
  createStripePaymentIntent,
  createStripeRefund,
  verifyStripeWebhook
} from "./src/stripe-provider.js";
import { createStoreRepository, restoreStore } from "./src/store-repository.js";
import { createStorageUploadProvider } from "./src/storage-provider.js";

const __dirname = typeof import.meta.url === "string"
  ? path.dirname(fileURLToPath(import.meta.url))
  : process.cwd();
const adminDir = path.resolve(__dirname, "../admin");
const mobileDir = path.resolve(__dirname, "../mobile");
const mockUploads = new Map();
const cloudflareMediaBucket = globalThis.__GOOD_VIBE_MEDIA_BUCKET__;
const storageUploadProvider = createStorageUploadProvider();
const emailProvider = createEmailProvider();
const firebaseAuthProvider = createFirebaseAuthProvider();
const usesFirebaseAuth = String(process.env.AUTH_PROVIDER ?? "local").toLowerCase() === "firebase";
const asyncIdempotencyInFlight = new Map();
const orderPaymentLocks = new Map();
let storeLockTail = Promise.resolve();
assertProductionConfiguration();
const storeRepository = createStoreRepository();
let store;
let storeInitialization;
let storeLastRefreshedAt = 0;
let storeRefreshPromise = null;
const configuredStoreRefreshTtlMs = Number(process.env.STORE_REFRESH_TTL_MS ?? 2_000);
const storeRefreshTtlMs = Number.isFinite(configuredStoreRefreshTtlMs)
  ? Math.max(250, configuredStoreRefreshTtlMs)
  : 2_000;
const port = Number(process.env.PORT ?? 8080);
if (process.env.NODE_ENV === "production" && !storageUploadProvider.enabled) {
  console.warn("Durable cloud storage is not configured; production uploads will return storage_not_configured");
}

const server = http.createServer(async (req, res) => {
  let rollbackSnapshot = null;
  let releaseMutationLock = null;
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
        service: "good-vibe-pilates-yoga-api",
        database: storeRepository.kind,
        authentication: usesFirebaseAuth ? "firebase" : "local",
        time: new Date().toISOString()
      });
      return;
    }

    if (url.pathname === "/payments/return" && req.method === "GET") {
      servePaymentReturnBridge(res, url);
      return;
    }

    if (["/privacy", "/privacy-choices", "/terms", "/support"].includes(url.pathname) && req.method === "GET") {
      serveLegalPage(res, url.pathname);
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

    if (url.pathname.startsWith("/mock-upload/") || url.pathname.startsWith("/assets/")) {
      await serveMockUpload(req, res, url);
      return;
    }

    if (!url.pathname.startsWith("/api/v1")) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    const isMediaBinaryUpload = req.method === "PUT" && (
      url.pathname.startsWith("/api/v1/me/avatar-upload/")
      || url.pathname.startsWith("/api/v1/admin/uploads/")
    );
    const isStripeWebhook = url.pathname === "/api/v1/payments/stripe/webhook" && req.method === "POST";
    const rawBody = isStripeWebhook ? await readRawBody(req) : null;
    const body = isStripeWebhook || isMediaBinaryUpload ? {} : await readJson(req);

    if (
      usesFirebaseAuth
      && storeRepository.enabled
      && isIsolatedFirebaseAuthRequest(req.method, url.pathname)
    ) {
      await handleIsolatedFirebaseAuth(res, url, body);
      return;
    }

    await initializeStore();
    if (storeRepository.enabled) {
      releaseMutationLock = await acquireStoreLock();
      await refreshStore({ force: isMutation(req.method) });
      if (isMutation(req.method)) {
        rollbackSnapshot = structuredClone(store);
        res.goodVibeDeferJson = true;
      }
    }

    if (isMediaBinaryUpload) {
      const auth = optionalAuth(req);
      req.goodVibeAuth = auth;
      await receiveCloudflareMediaUpload(req, res, url, auth);
      return;
    }

    if (isStripeWebhook) {
      const event = verifyStripeWebhook(rawBody, req.headers["stripe-signature"]);
      const result = applyStripeEvent(store, event);
      sendJson(res, 200, result);
      await persistAndFlush(res);
      return;
    }

    const isLogoutRequest = req.method === "POST" && url.pathname === "/api/v1/auth/logout";
    const auth = optionalAuth(req, { ignoreInvalid: isLogoutRequest });
    req.goodVibeAuth = auth;
    await routeApi(req, res, url, body, auth);
    await persistAndFlush(res);
  } catch (error) {
    if (rollbackSnapshot) restoreStore(store, rollbackSnapshot);
    res.goodVibeDeferJson = false;
    res.goodVibePendingJson = null;
    const status = error.status ?? 500;
    if (!res.headersSent) {
      sendJson(res, status, {
        error: error.code ?? "internal_error",
        message: error.message,
        details: error.details ?? error.stripe
      });
    }
  } finally {
    releaseMutationLock?.();
  }
});

function isIsolatedFirebaseAuthRequest(method, pathname) {
  return method === "POST" && [
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/email/resend"
  ].includes(pathname);
}

async function handleIsolatedFirebaseAuth(res, url, body) {
  const pathName = url.pathname.replace("/api/v1", "") || "/";

  if (pathName === "/auth/login") {
    const firebaseAccount = await firebaseAuthProvider.signIn({
      email: normalizeIdentity(body.identifier ?? body.email),
      password: body.password,
      locale: body.locale
    });
    const response = await mutateIsolatedStore((requestStore) => (
      loginWithFirebaseUser(requestStore, firebaseAccount, body, signToken)
    ));
    sendJson(res, 200, {
      ...response,
      firebase: {
        idToken: firebaseAccount.idToken,
        refreshToken: firebaseAccount.refreshToken,
        expiresIn: firebaseAccount.expiresIn
      }
    });
    return;
  }

  if (pathName === "/auth/register") {
    const registration = prepareFirebaseRegistration({ authIdentities: [] }, body);
    let firebaseAccount;
    let createdFirebaseAccount = false;
    try {
      firebaseAccount = await firebaseAuthProvider.signUp(registration);
      createdFirebaseAccount = true;
    } catch (error) {
      if (error?.code !== "email_already_in_use") throw error;
      firebaseAccount = await firebaseAuthProvider.signIn({
        email: registration.email,
        password: registration.password,
        locale: registration.locale
      });
    }
    let response;
    try {
      response = await mutateIsolatedStore((requestStore) => {
        const currentRegistration = prepareFirebaseRegistration(requestStore, body);
        return registerFirebaseUser(requestStore, currentRegistration, firebaseAccount.uid);
      });
    } catch (error) {
      if (createdFirebaseAccount) {
        await firebaseAuthProvider.deleteCurrentUser({ idToken: firebaseAccount.idToken }).catch(() => null);
      }
      throw error;
    }

    let verificationDeliveryPending = false;
    if (!firebaseAccount.emailVerified) {
      try {
        await firebaseAuthProvider.sendEmailVerification({
          idToken: firebaseAccount.idToken,
          locale: registration.locale
        });
      } catch (error) {
        verificationDeliveryPending = true;
        console.warn(`Firebase verification delivery is pending: ${error.code ?? "firebase_auth_failed"}`);
      }
    }
    sendJson(res, 201, {
      ...response,
      ...(verificationDeliveryPending ? { verificationDeliveryPending: true } : {})
    });
    return;
  }

  const firebaseAccount = await firebaseAuthProvider.signIn({
    email: normalizeIdentity(body.email),
    password: body.password,
    locale: body.locale
  });
  if (firebaseAccount.emailVerified) {
    throw problem(409, "email_already_verified", "Email is already verified");
  }
  await firebaseAuthProvider.sendEmailVerification({
    idToken: firebaseAccount.idToken,
    locale: body.locale
  });
  sendJson(res, 200, {
    requiresVerification: true,
    email: firebaseAccount.email,
    verificationMethod: "link"
  });
}

async function mutateIsolatedStore(handler, { maxAttempts = 3 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const repository = createStoreRepository();
    const requestStore = await operationWithTimeout(
      repository.load(createSeedStore()),
      8_000,
      "database_read_timeout",
      "Database read timed out"
    );
    try {
      const result = await handler(requestStore);
      await operationWithTimeout(
        repository.save(requestStore),
        8_000,
        "database_write_timeout",
        "Database write timed out"
      );
      storeLastRefreshedAt = 0;
      return result;
    } catch (error) {
      if (error?.code !== "database_write_conflict" || attempt === maxAttempts) throw error;
    }
  }
  throw problem(409, "database_write_conflict", "Database state changed during authentication");
}

function operationWithTimeout(operation, timeoutMs, code, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(problem(504, code, message)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

async function initializeStore() {
  if (store) return store;
  if (!storeInitialization) {
    storeInitialization = (async () => {
      const loadedStore = await storeRepository.load(createSeedStore());
      const translationsChanged = repairKnownTranslations(loadedStore);
      const fixedAdminChanged = enforceFixedAdminAccount(loadedStore);
      const operationalStateChanged = repairOperationalState(loadedStore);
      const storeNeedsSave = translationsChanged || fixedAdminChanged || operationalStateChanged;
      const productionStoreChanged = hardenProductionStore(loadedStore);
      if (storeNeedsSave || productionStoreChanged) {
        await storeRepository.save(loadedStore);
      }
      store = loadedStore;
      storeLastRefreshedAt = Date.now();
      return store;
    })().catch((error) => {
      storeInitialization = null;
      throw error;
    });
  }
  return storeInitialization;
}

async function refreshStore({ force = false } = {}) {
  await initializeStore();
  if (
    !storeRepository.enabled
    || (!force && Date.now() - storeLastRefreshedAt < storeRefreshTtlMs)
  ) {
    return store;
  }
  if (!storeRefreshPromise) {
    storeRefreshPromise = (async () => {
      const latestStore = await storeRepository.load(createSeedStore());
      restoreStore(store, latestStore);
      storeLastRefreshedAt = Date.now();
      return store;
    })().finally(() => {
      storeRefreshPromise = null;
    });
  }
  return storeRefreshPromise;
}

server.listen(port, () => {
  console.log(`Good Vibe Pilates & Yoga API listening on http://localhost:${port}`);
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
    if (!usesFirebaseAuth) {
      sendJson(res, 200, login(store, body, signToken));
      return;
    }
    const firebaseAccount = await firebaseAuthProvider.signIn({
      email: normalizeIdentity(body.identifier ?? body.email),
      password: body.password,
      locale: body.locale
    });
    const response = loginWithFirebaseUser(store, firebaseAccount, body, signToken);
    sendJson(res, 200, {
      ...response,
      firebase: {
        idToken: firebaseAccount.idToken,
        refreshToken: firebaseAccount.refreshToken,
        expiresIn: firebaseAccount.expiresIn
      }
    });
    return;
  }

  if (method === "POST" && pathName === "/auth/register") {
    if (usesFirebaseAuth) {
      const registration = prepareFirebaseRegistration(store, body);
      const firebaseAccount = await firebaseAuthProvider.signUp(registration);
      let response;
      try {
        response = registerFirebaseUser(store, registration, firebaseAccount.uid);
        await firebaseAuthProvider.sendEmailVerification({
          idToken: firebaseAccount.idToken,
          locale: registration.locale
        });
      } catch (error) {
        discardPendingRegistration(store, store.authIdentities.find((item) => item.firebaseUid === firebaseAccount.uid)?.userId);
        await firebaseAuthProvider.deleteCurrentUser({ idToken: firebaseAccount.idToken }).catch(() => null);
        throw error;
      }
      sendJson(res, 201, response);
      return;
    }
    if (!emailProvider.enabled) throw problem(503, "email_service_not_configured", "Email delivery is not configured");
    const registration = register(store, body, signToken);
    try {
      await emailProvider.sendVerification({
        to: registration.delivery.email,
        code: registration.delivery.code,
        locale: body.locale
      });
    } catch (error) {
      discardPendingRegistration(store, registration.userId);
      throw error;
    }
    sendJson(res, 201, registration.response);
    return;
  }

  if (method === "POST" && pathName === "/auth/email/verify") {
    if (usesFirebaseAuth) {
      throw problem(410, "verification_link_required", "Open the Firebase verification link in your email, then sign in again");
    }
    sendJson(res, 200, verifyEmailRegistration(store, body, signToken));
    return;
  }

  if (method === "POST" && pathName === "/auth/email/resend") {
    if (usesFirebaseAuth) {
      const firebaseAccount = await firebaseAuthProvider.signIn({
        email: normalizeIdentity(body.email),
        password: body.password,
        locale: body.locale
      });
      if (firebaseAccount.emailVerified) {
        throw problem(409, "email_already_verified", "Email is already verified");
      }
      await firebaseAuthProvider.sendEmailVerification({
        idToken: firebaseAccount.idToken,
        locale: body.locale
      });
      sendJson(res, 200, {
        requiresVerification: true,
        email: firebaseAccount.email,
        verificationMethod: "link"
      });
      return;
    }
    if (!emailProvider.enabled) throw problem(503, "email_service_not_configured", "Email delivery is not configured");
    const previousChallenges = structuredClone(store.emailVerificationChallenges);
    const verification = resendEmailVerification(store, body);
    try {
      await emailProvider.sendVerification({
        to: verification.delivery.email,
        code: verification.delivery.code,
        locale: body.locale
      });
    } catch (error) {
      store.emailVerificationChallenges = previousChallenges;
      throw error;
    }
    sendJson(res, 200, verification.response);
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

  if (method === "POST" && pathName === "/me/avatar-upload") {
    requireAuth(auth);
    sendJson(res, 200, await createAvatarUpload(body, auth));
    return;
  }

  if (method === "PATCH" && pathName === "/me/avatar") {
    requireAuth(auth);
    const objectKey = String(body.objectKey ?? "");
    const objectPrefix = `avatars/${sanitizeFileName(auth.userId)}/`;
    if (!objectKey.startsWith(objectPrefix) || objectKey.slice(objectPrefix.length).includes("/")) {
      throw problem(400, "invalid_avatar_object", "Avatar object key is invalid");
    }
    if (storageUploadProvider.kind === "memory") {
      const upload = mockUploads.get(objectKey);
      if (!upload || upload.body === null) {
        throw problem(409, "avatar_upload_incomplete", "Upload the avatar image before saving it");
      }
    }
    const user = byIdRequired(store.users, auth.userId, "user_not_found");
    user.avatarUrl = publicUrlForObjectKey(objectKey);
    user.avatarObjectKey = objectKey;
    user.updatedAt = new Date().toISOString();
    audit(store, auth, "profile.avatar.updated", user.id, { objectKey });
    sendJson(res, 200, getCurrentUser(store, auth).user);
    return;
  }

  if (method === "GET" && pathName === "/legal") {
    const origin = baseUrl().replace(/\/+$/, "");
    sendJson(res, 200, {
      privacyPolicyUrl: `${origin}/privacy`,
      privacyChoicesUrl: `${origin}/privacy-choices`,
      termsUrl: `${origin}/terms`,
      supportUrl: `${origin}/support`,
      region: "California, US",
      timezone: "America/Los_Angeles"
    });
    return;
  }

  if (method === "POST" && pathName === "/privacy/requests") {
    requireAuth(auth);
    sendJson(res, 201, createPrivacyRequest(store, auth, body));
    return;
  }

  if (method === "GET" && pathName === "/privacy/export") {
    requireAuth(auth);
    sendJson(res, 200, exportPrivacyData(store, auth));
    return;
  }

  if (method === "POST" && pathName === "/privacy/account-deletion") {
    requireAuth(auth);
    const result = deleteAccount(store, auth);
    if (usesFirebaseAuth) {
      const refreshed = await firebaseAuthProvider.refreshSession({ refreshToken: body.firebaseRefreshToken });
      await firebaseAuthProvider.deleteCurrentUser({ idToken: refreshed.idToken });
    }
    sendJson(res, 200, result);
    return;
  }

  if (method === "GET" && pathName === "/home") {
    const activeCourses = store.courses.filter(isActiveEntity);
    const activeProducts = store.products.filter(isActiveEntity);
    const activeContent = store.contentBlocks
      .filter((item) => item.active)
      .toSorted((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
    sendJson(res, 200, {
      banners: activeContent.filter((item) => item.type === "banner").map((item) => localizeEntity(item, locale)),
      features: activeContent.filter((item) => item.type === "feature").map((item) => localizeEntity(item, locale)),
      knowledge: activeContent.filter((item) => item.type === "knowledge").map((item) => localizeEntity(item, locale)),
      recommendedCourses: activeCourses.map((item) => localizeEntity(item, locale)),
      recommendedCoaches: store.coaches.map((item) => localizeEntity(item, locale)),
      storeRecommendations: activeProducts.map((item) => localizeEntity(item, locale))
    });
    return;
  }

  if (method === "GET" && pathName === "/courses") {
    sendJson(res, 200, store.courses.filter(isActiveEntity).map((item) => localizeEntity(item, locale)));
    return;
  }

  if (method === "GET" && segments[0] === "courses" && segments[1]) {
    const course = store.courses.find((item) => item.id === segments[1] && isActiveEntity(item));
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
    const activeCourseIds = new Set(store.courses.filter(isActiveEntity).map((course) => course.id));
    const sessions = store.courseSessions
      .filter((session) => !coachId || session.coachId === coachId)
      .filter((session) => !courseId || session.courseId === courseId)
      .filter((session) => activeCourseIds.has(session.courseId))
      .filter((session) => effectiveCourseSessionStatus(session) === "open")
      .filter((session) => new Date(session.startsAt).getTime() > Date.now())
      .toSorted((left, right) => new Date(left.startsAt) - new Date(right.startsAt))
      .map((session) => ({
        ...session,
        remainingCapacity: Math.max(0, session.capacity - session.bookedCount),
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
    if (auth.activeRole === ROLES.COACH) {
      const coach = store.coaches.find((item) => item.userId === auth.userId);
      if (!coach || booking.coachId !== coach.id) {
        throw problem(403, "coach_booking_forbidden", "Coaches can only access bookings for their own sessions");
      }
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
    requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
    let cards = store.memberCards;
    if (auth.activeRole === ROLES.STUDENT) cards = cards.filter((card) => card.userId === auth.userId);
    sendJson(res, 200, cards.map((card) => normalizeMemberCardStatus(card)));
    return;
  }

  if (method === "GET" && segments[0] === "member-cards" && segments[2] === "transactions") {
    requireAuth(auth);
    requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
    const card = store.memberCards.find((item) => item.id === segments[1]);
    if (!card) throw problem(404, "member_card_not_found", "Member card not found");
    if (auth.activeRole === ROLES.STUDENT && card.userId !== auth.userId) {
      throw problem(403, "forbidden", "Cannot access another user's member card");
    }
    sendJson(res, 200, store.cardTransactions.filter((item) => item.cardId === card.id));
    return;
  }

  if (method === "POST" && segments[0] === "member-cards" && segments[2] === "cancel-request") {
    requireAuth(auth);
    sendJson(res, 201, requestMembershipCancellation(store, auth, segments[1], body));
    return;
  }

  if (method === "POST" && segments[0] === "member-cards" && ["freeze", "extend", "transfer", "upgrade"].includes(segments[2])) {
    requireAuth(auth);
    sendJson(res, 200, memberCardOperation(store, auth, segments[1], segments[2], body));
    return;
  }

  if (method === "GET" && pathName === "/products") {
    sendJson(res, 200, store.products.filter(isActiveEntity).map((item) => localizeEntity(item, locale)));
    return;
  }

  if (method === "POST" && pathName === "/orders") {
    requireAuth(auth);
    sendJson(res, 201, createOrder(store, auth, body, req.headers["idempotency-key"]));
    return;
  }

  if (method === "GET" && pathName === "/orders") {
    requireAuth(auth);
    requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
    let orders = store.orders;
    if (auth.activeRole === ROLES.STUDENT) orders = orders.filter((order) => order.userId === auth.userId);
    sendJson(res, 200, orders.map(enrichOrder));
    return;
  }

  if (method === "GET" && segments[0] === "orders" && segments[1]) {
    requireAuth(auth);
    requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
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
      currency: url.searchParams.get("currency") ?? "USD",
      country: url.searchParams.get("country") ?? "US",
      recurring: url.searchParams.get("recurring") === "true",
      all: url.searchParams.get("scope") === "all"
    }));
    return;
  }

  if (method === "POST" && pathName === "/payments/stripe/payment-intents") {
    requireAuth(auth);
    await requireIdempotencyAsync(
      req,
      paymentIdempotencyScope("payment-intent", auth, body.orderId),
      () => withOrderPaymentLock(body.orderId, async () => {
        const paymentRequest = validatePaymentRequest(store, auth, body);
        rejectExistingOrderPayment(paymentRequest, "payment-intent");
        const user = store.users.find((item) => item.id === auth.userId);
        const returnLocale = normalizePaymentReturnLocale(body.locale ?? user?.locale ?? auth.locale);
        const stripeResult = await createStripePaymentIntent({
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          methodCode: paymentRequest.methodCode,
          orderId: paymentRequest.orderId,
          customerEmail: user?.email,
          returnUrl: body.returnUrl ?? paymentReturnUrl("pending", returnLocale),
          idempotencyKey: stripeCreationIdempotencyKey("payment-intent", auth, body.orderId, req.headers["idempotency-key"])
        });
        const payment = createPaymentRecord(store, auth, {
          ...paymentRequest,
          providerPayload: {
            paymentIntentId: stripeResult.id ?? stripeResult.paymentIntentId,
            mode: stripeResult.mode ?? "live"
          }
        });
        return { payment, stripe: stripeResult };
      }),
      res,
      201
    );
    return;
  }

  if (method === "POST" && pathName === "/payments/stripe/payment-sheet") {
    requireAuth(auth);
    await requireIdempotencyAsync(
      req,
      paymentIdempotencyScope("payment-sheet", auth, body.orderId),
      () => withOrderPaymentLock(body.orderId, async () => {
        const paymentRequest = validatePaymentRequest(store, auth, body);
        rejectExistingOrderPayment(paymentRequest, "payment-sheet");
        const user = store.users.find((item) => item.id === auth.userId);
        const stripeResult = await createStripePaymentSheet({
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          methodCode: paymentRequest.methodCode,
          orderId: paymentRequest.orderId,
          customerEmail: user?.email,
          merchantIdentifier: body.merchantIdentifier,
          idempotencyKey: stripeCreationIdempotencyKey("payment-sheet", auth, body.orderId, req.headers["idempotency-key"])
        });
        const payment = createPaymentRecord(store, auth, {
          ...paymentRequest,
          providerPayload: {
            paymentIntentId: stripeResult.paymentIntentId,
            mode: stripeResult.mode ?? "live"
          }
        });
        return { payment, stripe: stripeResult };
      }),
      res,
      201
    );
    return;
  }

  if (method === "POST" && pathName === "/payments/stripe/checkout-sessions") {
    requireAuth(auth);
    await requireIdempotencyAsync(
      req,
      paymentIdempotencyScope("checkout", auth, body.orderId),
      () => withOrderPaymentLock(body.orderId, async () => {
        const paymentRequest = validatePaymentRequest(store, auth, body);
        const existingResponse = reusableCheckoutResponse(paymentRequest);
        if (existingResponse) return existingResponse;
        rejectExistingOrderPayment(paymentRequest, "checkout");
        const user = store.users.find((item) => item.id === auth.userId);
        const returnLocale = normalizePaymentReturnLocale(body.locale ?? user?.locale ?? auth.locale);
        const stripeResult = await createStripeCheckoutSession({
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          methodCode: paymentRequest.methodCode,
          orderId: paymentRequest.orderId,
          productName: body.productName ?? "Good Vibe Pilates & Yoga",
          customerEmail: user?.email,
          successUrl: paymentReturnUrl("success", returnLocale, { includeCheckoutSession: true }),
          cancelUrl: paymentReturnUrl("cancel", returnLocale),
          idempotencyKey: stripeCreationIdempotencyKey("checkout", auth, body.orderId, req.headers["idempotency-key"])
        });
        const checkoutExpiresAt = stripeResult.expiresAt
          ?? (Number.isSafeInteger(stripeResult.expires_at)
            ? new Date(stripeResult.expires_at * 1000).toISOString()
            : null);
        const payment = createPaymentRecord(store, auth, {
          ...paymentRequest,
          providerPayload: {
            checkoutSessionId: stripeResult.id ?? stripeResult.checkoutSessionId,
            checkoutUrl: stripeResult.url,
            checkoutExpiresAt,
            mode: stripeResult.mode ?? "live"
          }
        });
        return { payment, stripe: stripeResult };
      }),
      res,
      201
    );
    return;
  }

  if (method === "POST" && segments[0] === "payments" && segments[2] === "refunds") {
    requireAuth(auth);
    requireRole(auth, [ROLES.STAFF, ROLES.ADMIN]);
    await requireIdempotencyAsync(
      req,
      `payments.refunds.${segments[1]}`,
      () => withOrderPaymentLock(
        `refund:${segments[1]}`,
        () => performRefund(segments[1], body, auth, req.headers["idempotency-key"])
      ),
      res,
      201
    );
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
    await routeAdmin(req, res, segments.slice(1), body, auth);
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
        status: effectiveCourseSessionStatus(session),
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

async function routeAdmin(req, res, segments, body, adminAuth) {
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
      const updates = allowed(body, ["name", "email", "phone", "locale", "roles"]);
      if (Object.hasOwn(updates, "roles")) {
        updates.roles = normalizeRoles(updates.roles);
      }
      if (Object.hasOwn(updates, "email")) {
        const email = normalizeIdentity(updates.email);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          throw problem(400, "invalid_email", "email must be a valid address");
        }
        ensureFixedAdminMutationAllowed(user, updates.roles ?? user.roles, { nextEmail: email });
        const duplicateIdentity = store.authIdentities.find((identity) => (
          identity.type === "email" && identity.value === email && identity.userId !== user.id
        ));
        if (duplicateIdentity) throw problem(409, "email_already_in_use", "Email is already in use");
        const identities = store.authIdentities.filter((identity) => identity.type === "email" && identity.userId === user.id);
        if (!identities.length) {
          throw problem(409, "login_identity_missing", "Member has no email login identity to update");
        }
        for (const identity of identities) identity.value = email;
        updates.email = email;
      } else if (Object.hasOwn(updates, "roles")) {
        ensureFixedAdminMutationAllowed(user, updates.roles);
      }
      Object.assign(user, updates, { updatedAt: new Date().toISOString() });
      if (Object.hasOwn(updates, "roles")) revokeInvalidRoleSessions(user.id, user.roles);
      audit(store, adminAuth, "admin.member.update", user.id, body);
      return user;
    }, res);
    return;
  }

  if (resource === "member-cards" && idValue && ["freeze", "extend", "transfer", "upgrade"].includes(subresource) && req.method === "POST") {
    requireAdminIdempotency(req, `admin.member_cards.${subresource}`, () => memberCardOperation(store, adminAuth, idValue, subresource, body), res);
    return;
  }

  if (resource === "payments" && idValue && subresource === "refunds" && req.method === "POST") {
    await requireIdempotencyAsync(
      req,
      `admin.payments.refunds.${idValue}`,
      () => withOrderPaymentLock(
        `refund:${idValue}`,
        () => performRefund(idValue, body, adminAuth, req.headers["idempotency-key"])
      ),
      res
    );
    return;
  }

  if (resource === "uploads" && idValue === "presign" && req.method === "POST") {
    await requireIdempotencyAsync(req, "admin.uploads.presign", async () => {
      const upload = await createAdminUpload(body);
      audit(store, adminAuth, "admin.upload.presign", upload.objectKey, upload);
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
    sendJson(res, 200, resource === "payments"
      ? collection.map(enrichAdminPayment)
      : collection.map((item) => adminEntityForResponse(resource, item)));
    return;
  }

  if (req.method === "POST" && !idValue) {
    requireAdminIdempotency(req, `admin.${resource}.create`, () => {
      const entity = normalizeAdminEntity(resource, {
        id: body.id ?? `${resource}_${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString()
      }, { isCreate: true });
      if (collection.some((candidate) => candidate.id === entity.id)) {
        throw problem(409, "duplicate_entity_id", "An entity with this id already exists");
      }
      if (resource === "users") ensureFixedAdminMutationAllowed(entity, entity.roles);
      collection.push(entity);
      audit(store, adminAuth, `admin.${resource}.create`, entity.id, body);
      return entity;
    }, res, 201);
    return;
  }

  const index = collection.findIndex((item) => item.id === idValue);
  if (index < 0) throw problem(404, "admin_entity_not_found", "Admin entity not found");

  if (req.method === "GET") {
    sendJson(res, 200, resource === "payments"
      ? enrichAdminPayment(collection[index])
      : adminEntityForResponse(resource, collection[index]));
    return;
  }

  if (req.method === "PATCH") {
    requireAdminIdempotency(req, `admin.${resource}.update`, () => {
      const updated = normalizeAdminEntity(resource, {
        ...collection[index],
        ...body,
        updatedAt: new Date().toISOString()
      });
      if (resource === "users") {
        ensureFixedAdminMutationAllowed(collection[index], updated.roles, { nextEmail: updated.email });
      }
      collection[index] = updated;
      if (resource === "users") revokeInvalidRoleSessions(collection[index].id, collection[index].roles);
      audit(store, adminAuth, `admin.${resource}.update`, collection[index].id, body);
      return collection[index];
    }, res);
    return;
  }

  if (req.method === "DELETE") {
    requireAdminIdempotency(req, `admin.${resource}.delete`, () => {
      if (resource === "users") ensureFixedAdminMutationAllowed(collection[index], [], { deleting: true });
      const [deleted] = collection.splice(index, 1);
      if (resource === "users") revokeInvalidRoleSessions(deleted.id, []);
      audit(store, adminAuth, `admin.${resource}.delete`, deleted.id, {});
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
    "privacy-requests": store.privacyRequests,
    "membership-cancellation-requests": store.membershipCancellationRequests,
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
  }).map((session) => adminEntityForResponse("course-sessions", session));
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
  const actorScope = requestIdempotencyScope(req, scope);
  const existing = store.idempotencyRecords.find((record) => record.key === key && record.scope === actorScope);
  if (existing) {
    sendJson(res, status, existing.response);
    return;
  }
  const response = handler();
  store.idempotencyRecords.push({
    id: id("idem"),
    key,
    scope: actorScope,
    response,
    createdAt: new Date().toISOString()
  });
  sendJson(res, status, response);
}

function requestIdempotencyScope(req, scope) {
  return `${scope}:actor:${req.goodVibeAuth?.userId ?? "anonymous"}`;
}

async function requireIdempotencyAsync(req, scope, handler, res, status = 200) {
  const key = req.headers["idempotency-key"];
  if (!key) throw problem(400, "missing_idempotency_key", "Idempotency-Key header is required");
  const actorScope = requestIdempotencyScope(req, scope);
  const existing = store.idempotencyRecords.find((record) => record.key === key && record.scope === actorScope);
  if (existing) {
    sendJson(res, status, existing.response);
    return existing.response;
  }
  const inFlightKey = `${actorScope}::${key}`;
  let operation = asyncIdempotencyInFlight.get(inFlightKey);
  if (!operation) {
    operation = (async () => {
      const response = await handler();
      store.idempotencyRecords.push({
        id: id("idem"),
        key,
        scope: actorScope,
        response,
        createdAt: new Date().toISOString()
      });
      return response;
    })();
    asyncIdempotencyInFlight.set(inFlightKey, operation);
  }
  let response;
  try {
    response = await operation;
  } finally {
    if (asyncIdempotencyInFlight.get(inFlightKey) === operation) {
      asyncIdempotencyInFlight.delete(inFlightKey);
    }
  }
  sendJson(res, status, response);
  return response;
}

async function performRefund(paymentId, body, auth, idempotencyKey) {
  const prepared = prepareRefund(store, paymentId, body.amount);
  const providerRefund = await createStripeRefund({
    paymentIntentId: prepared.payment.stripePaymentIntentId,
    chargeId: prepared.payment.stripeChargeId,
    amount: prepared.amount,
    reason: body.reason,
    idempotencyKey: `good-vibe-refund:${paymentId}:${idempotencyKey}`.slice(0, 255)
  });
  const result = recordRefund(store, paymentId, {
    amount: prepared.amount,
    reason: body.reason,
    providerRefundId: providerRefund.id,
    status: providerRefund.status ?? "succeeded"
  });
  audit(store, auth, "payment.refund", paymentId, {
    refundId: result.refund.id,
    providerRefundId: result.refund.providerRefundId,
    amount: result.refund.amount
  });
  return { ...result, stripe: providerRefund };
}

function allowed(source, keys) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => keys.includes(key)));
}

function isActiveEntity(entity) {
  return entity?.active !== false;
}

function adminEntityForResponse(resource, entity) {
  if (resource !== "course-sessions") return entity;
  return {
    ...entity,
    status: effectiveCourseSessionStatus(entity)
  };
}

function normalizeAdminEntity(resource, source, { isCreate = false } = {}) {
  const entity = { ...source };
  if (resource === "users") entity.roles = normalizeRoles(entity.roles);
  if (["courses", "products", "content-blocks"].includes(resource) && isCreate && entity.active === undefined) {
    entity.active = true;
  }
  if (resource === "courses" && entity.imageUrl !== undefined) {
    entity.imageUrl = normalizeCourseImageUrl(entity.imageUrl);
  }
  if (resource === "course-sessions" && isCreate && entity.bookedCount === undefined) {
    entity.bookedCount = 0;
  }
  if (resource === "course-sessions" && isCreate && entity.status === undefined) {
    entity.status = "open";
  }
  const positiveFields = {
    courses: ["durationMinutes", "priceAmount", "capacity", "memberCardDeductCount"],
    "course-sessions": ["capacity"],
    "membership-plans": ["totalCredits", "priceAmount", "validityDays"],
    "member-cards": ["totalCredits"],
    products: ["priceAmount"]
  }[resource] ?? [];
  const nonNegativeFields = {
    "course-sessions": ["bookedCount"],
    "member-cards": ["remainingCredits"],
    products: ["stock"]
  }[resource] ?? [];

  for (const field of positiveFields) {
    if (entity[field] === undefined) continue;
    entity[field] = requireAdminInteger(entity[field], field, { allowZero: false });
  }
  for (const field of nonNegativeFields) {
    if (entity[field] === undefined) continue;
    entity[field] = requireAdminInteger(entity[field], field, { allowZero: true });
  }
  if (resource === "course-sessions" && entity.capacity !== undefined && entity.bookedCount > entity.capacity) {
    throw problem(400, "invalid_booked_count", "bookedCount cannot exceed capacity");
  }
  if (resource === "member-cards" && entity.totalCredits !== undefined && entity.remainingCredits > entity.totalCredits) {
    throw problem(400, "invalid_card_credits", "remainingCredits cannot exceed totalCredits");
  }
  if (resource === "coaches") {
    const user = byIdRequired(store.users, entity.userId, "user_not_found");
    if (!user.roles?.includes(ROLES.COACH)) {
      throw problem(409, "coach_role_required", "Coach profile user must have the coach role");
    }
  }
  if (resource === "course-sessions") {
    byIdRequired(store.courses, entity.courseId, "course_not_found");
    byIdRequired(store.coaches, entity.coachId, "coach_not_found");
    if (!["draft", "open", "closed", "cancelled"].includes(entity.status)) {
      throw problem(400, "invalid_session_status", "status must be draft, open, closed, or cancelled");
    }
    const startsAt = new Date(entity.startsAt).getTime();
    const endsAt = new Date(entity.endsAt).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
      throw problem(400, "invalid_session_time", "endsAt must be later than startsAt");
    }
    if (isCreate && startsAt <= Date.now()) {
      throw problem(409, "session_started", "New course sessions must start in the future");
    }
    entity.status = effectiveCourseSessionStatus(entity);
  }
  if (resource === "member-cards") {
    byIdRequired(store.users, entity.userId, "user_not_found");
    if (entity.planId) byIdRequired(store.membershipPlans, entity.planId, "membership_plan_not_found");
  }
  return entity;
}

function normalizeCourseImageUrl(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw problem(400, "invalid_course_image_url", "Course image URL must be a valid HTTP or HTTPS URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw problem(400, "invalid_course_image_url", "Course image URL must use HTTP or HTTPS");
  }
  return url.toString();
}

function normalizeRoles(value) {
  const allowedRoles = new Set(Object.values(ROLES));
  if (!Array.isArray(value) || value.length === 0 || value.some((role) => !allowedRoles.has(role))) {
    throw problem(400, "invalid_roles", "roles must be a non-empty array containing only student, coach, staff, or admin");
  }
  return [...new Set(value)];
}

function ensureFixedAdminMutationAllowed(user, nextRoles, { nextEmail, deleting = false } = {}) {
  if (user.id === FIXED_ADMIN_USER_ID) {
    if (deleting || !nextRoles.includes(ROLES.ADMIN)) {
      throw problem(409, "last_admin_required", "The fixed administrator account cannot be removed");
    }
    if (nextEmail !== undefined && normalizeIdentity(nextEmail) !== normalizeIdentity(user.email)) {
      throw problem(409, "fixed_admin_identity", "The fixed administrator email cannot be changed");
    }
    return;
  }
  if (nextRoles.includes(ROLES.ADMIN)) {
    throw problem(409, "fixed_admin_only", "Administrator access belongs only to the fixed administrator account");
  }
}

function revokeInvalidRoleSessions(userId, validRoles) {
  const revokedAt = new Date().toISOString();
  for (const session of store.roleSessions) {
    if (session.userId === userId && !session.revokedAt && !validRoles.includes(session.activeRole)) {
      session.revokedAt = revokedAt;
    }
  }
}

function requireAdminInteger(value, field, { allowZero }) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1)) {
    throw problem(400, `invalid_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`, `${field} must be ${allowZero ? "a non-negative" : "a positive"} integer`);
  }
  return number;
}

function sanitizeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function createAdminUpload(body) {
  const scope = sanitizeFileName(body.scope ?? "admin").replace(/^\.+$/, "admin") || "admin";
  const contentType = String(body.contentType ?? "application/octet-stream").toLowerCase().split(";")[0].trim();
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  if ((scope === "courses" || contentType.startsWith("image/")) && !allowedTypes.has(contentType)) {
    throw problem(400, "invalid_upload_type", "Upload must be a JPEG, PNG, WebP, HEIC, or HEIF image");
  }
  const fileSize = Number(body.fileSize ?? 0);
  if (fileSize && (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > 10_000_000)) {
    throw problem(413, "upload_too_large", "Image must be 10 MB or smaller");
  }
  const objectKey = `${scope}/${Date.now()}-${sanitizeFileName(body.fileName ?? "upload.bin")}`;
  return createUpload(objectKey, contentType);
}

async function createAvatarUpload(body, auth) {
  const contentType = String(body.contentType ?? "").toLowerCase().split(";")[0].trim();
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  if (!allowedTypes.has(contentType)) {
    throw problem(400, "invalid_avatar_type", "Avatar must be a JPEG, PNG, WebP, HEIC, or HEIF image");
  }
  const fileSize = Number(body.fileSize ?? 0);
  if (fileSize && (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > 10_000_000)) {
    throw problem(413, "avatar_too_large", "Avatar image must be 10 MB or smaller");
  }
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif"
  }[contentType];
  const objectKey = `avatars/${sanitizeFileName(auth.userId)}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${extension}`;
  return createUpload(objectKey, contentType);
}

async function createUpload(objectKey, contentType) {
  if (cloudflareMediaBucket && isAllowedMediaObjectKey(objectKey)) {
    const uploadPath = objectKey.startsWith("avatars/")
      ? "/api/v1/me/avatar-upload/"
      : "/api/v1/admin/uploads/";
    return {
      storage: "r2",
      objectKey,
      uploadUrl: `${baseUrl()}${uploadPath}${encodeURIComponent(objectKey)}`,
      publicUrl: `${baseUrl()}/assets/${encodeURIComponent(objectKey)}`,
      headers: { "Content-Type": contentType },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };
  }
  if (storageUploadProvider.enabled || storageUploadProvider.kind === "misconfigured") {
    return storageUploadProvider.createSignedUpload({
      objectKey,
      contentType
    });
  }
  if (process.env.NODE_ENV === "production") {
    throw problem(503, "storage_not_configured", "Durable cloud storage must be configured for production uploads");
  }
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const upload = {
    storage: "memory",
    objectKey,
    uploadUrl: `${baseUrl()}/mock-upload/${encodeURIComponent(objectKey)}`,
    publicUrl: `${baseUrl()}/assets/${encodeURIComponent(objectKey)}`,
    expiresAt: expiresAt.toISOString()
  };
  mockUploads.set(objectKey, { body: null, contentType: "application/octet-stream", expiresAt: expiresAt.getTime() });
  return upload;
}

function publicUrlForObjectKey(objectKey) {
  if (cloudflareMediaBucket && isAllowedMediaObjectKey(objectKey)) {
    return `${baseUrl()}/assets/${encodeURIComponent(objectKey)}`;
  }
  if (storageUploadProvider.enabled || storageUploadProvider.kind === "misconfigured") {
    return storageUploadProvider.publicUrlFor(objectKey);
  }
  return `${baseUrl()}/assets/${encodeURIComponent(objectKey)}`;
}

function isAllowedMediaObjectKey(objectKey) {
  if (objectKey.includes("..") || objectKey.includes("\\") || objectKey.includes("\0")) return false;
  return ["avatars/", "courses/", "content/"].some((prefix) => objectKey.startsWith(prefix));
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

function enrichAdminPayment(payment) {
  const { stripeCheckoutUrl: _checkoutCapabilityUrl, ...safePayment } = payment;
  const paymentRefunds = store.refunds.filter((refund) => refund.paymentId === payment.id);
  const locallyRefundedAmount = paymentRefunds
    .filter((refund) => refund.status === "succeeded")
    .reduce((sum, refund) => sum + refund.amount, 0);
  const locallyCommittedAmount = paymentRefunds
    .filter((refund) => !["failed", "canceled"].includes(refund.status))
    .reduce((sum, refund) => sum + refund.amount, 0);
  const providerRefundedAmount = Number.isSafeInteger(payment.stripeAmountRefunded)
    ? payment.stripeAmountRefunded
    : 0;
  const terminalRefundedAmount = payment.status === "refunded" || payment.refundStatus === "refunded"
    ? payment.amount
    : 0;
  const refundedAmount = Math.min(
    payment.amount,
    Math.max(locallyRefundedAmount, providerRefundedAmount, terminalRefundedAmount)
  );
  const committedAmount = Math.min(payment.amount, Math.max(locallyCommittedAmount, providerRefundedAmount));
  const refundableAmount = payment.status === "succeeded"
    ? Math.max(0, payment.amount - committedAmount)
    : 0;
  return {
    ...safePayment,
    refundedAmount,
    refundableAmount
  };
}

function paymentIdempotencyScope(flow, auth, orderId) {
  return `payments.create.${flow}.${auth.userId}.${orderId ?? "standalone"}`;
}

function stripeCreationIdempotencyKey(flow, auth, orderId, clientKey) {
  const digest = crypto
    .createHash("sha256")
    .update(`${flow}:${auth.userId}:${orderId ?? "standalone"}:${clientKey}`)
    .digest("hex");
  return `good-vibe-${flow}-${digest}`;
}

async function acquireStoreLock() {
  const previous = storeLockTail;
  let release;
  storeLockTail = new Promise((resolve) => {
    release = resolve;
  });
  await previous.catch(() => {});
  return () => release();
}

async function withOrderPaymentLock(orderId, handler) {
  if (!orderId) return handler();
  const previous = orderPaymentLocks.get(orderId) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  orderPaymentLocks.set(orderId, current);
  await previous.catch(() => {});
  try {
    return await handler();
  } finally {
    release();
    if (orderPaymentLocks.get(orderId) === current) orderPaymentLocks.delete(orderId);
  }
}

function reusableCheckoutResponse(paymentRequest) {
  const existing = activeOrderPayment(paymentRequest.orderId);
  if (!existing) return null;
  if (
    existing.paymentMethodCode !== paymentRequest.methodCode
    || !existing.stripeCheckoutSessionId
    || !existing.stripeCheckoutUrl
  ) {
    return null;
  }
  const expiresAt = existing.stripeCheckoutExpiresAt
    ? new Date(existing.stripeCheckoutExpiresAt).getTime()
    : new Date(existing.createdAt).getTime() + 24 * 60 * 60 * 1000;
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    existing.status = "failed";
    releasePendingOrderResources(store, existing.orderId, "payment_expired");
    return null;
  }
  return {
    payment: existing,
    stripe: {
      mode: existing.stripeMode ?? "live",
      id: existing.stripeCheckoutSessionId,
      checkoutSessionId: existing.stripeCheckoutSessionId,
      url: existing.stripeCheckoutUrl,
      expiresAt: existing.stripeCheckoutExpiresAt,
      reused: true
    }
  };
}

function rejectExistingOrderPayment(paymentRequest, requestedFlow) {
  const existing = activeOrderPayment(paymentRequest.orderId);
  if (!existing) return;
  const error = problem(409, "order_payment_in_progress", "This order already has an active payment attempt");
  error.details = {
    paymentId: existing.id,
    paymentStatus: existing.status,
    requestedFlow,
    recovery: existing.stripeCheckoutUrl ? "reuse_checkout" : "wait_or_retry_after_failure"
  };
  throw error;
}

function activeOrderPayment(orderId) {
  if (!orderId) return null;
  const candidates = store.payments.filter((payment) => payment.orderId === orderId);
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const payment = candidates[index];
    if (payment.status === "failed") continue;
    if (isExpiredCheckoutPayment(payment)) {
      payment.status = "failed";
      releasePendingOrderResources(store, payment.orderId, "payment_expired");
      continue;
    }
    return payment;
  }
  return null;
}

function isExpiredCheckoutPayment(payment) {
  if (!payment.stripeCheckoutSessionId) return false;
  const expiresAt = payment.stripeCheckoutExpiresAt
    ? new Date(payment.stripeCheckoutExpiresAt).getTime()
    : new Date(payment.createdAt).getTime() + 24 * 60 * 60 * 1000;
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
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
  try {
    return JSON.parse(raw);
  } catch {
    throw problem(400, "invalid_json", "Request body must be valid JSON");
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let settled = false;
    const timer = setTimeout(() => {
      finish(reject, problem(408, "request_body_timeout", "Request body timed out"));
    }, 10_000);

    function cleanup() {
      clearTimeout(timer);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
    }

    function finish(handler, value) {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    }

    function onData(chunk) {
      raw += chunk;
      if (raw.length > 2_000_000) {
        finish(reject, problem(413, "payload_too_large", "Payload too large"));
      }
    }

    function onEnd() {
      finish(resolve, raw);
    }

    function onError(error) {
      finish(reject, error);
    }

    function onAborted() {
      finish(reject, problem(400, "request_aborted", "Request was aborted"));
    }

    req.setEncoding("utf8");
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });
}

function readBinaryBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 10_000_000) {
        reject(problem(413, "payload_too_large", "Upload exceeds 10 MB"));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function receiveCloudflareMediaUpload(req, res, url, auth) {
  requireAuth(auth);
  if (!cloudflareMediaBucket || typeof cloudflareMediaBucket.put !== "function") {
    throw problem(503, "storage_not_configured", "Cloudflare R2 media storage is not configured");
  }

  const isAvatarUpload = url.pathname.startsWith("/api/v1/me/avatar-upload/");
  const uploadPrefix = isAvatarUpload ? "/api/v1/me/avatar-upload/" : "/api/v1/admin/uploads/";
  let objectKey;
  try {
    objectKey = decodeURIComponent(url.pathname.slice(uploadPrefix.length));
  } catch {
    throw problem(400, "invalid_media_object", "Media object key is invalid");
  }

  if (isAvatarUpload) {
    const objectPrefix = `avatars/${sanitizeFileName(auth.userId)}/`;
    if (!objectKey.startsWith(objectPrefix) || objectKey.slice(objectPrefix.length).includes("/")) {
      throw problem(400, "invalid_avatar_object", "Avatar object key is invalid");
    }
  } else {
    requireRole(auth, [ROLES.ADMIN]);
    const validAdminKey = ["courses/", "content/"].some(
      (prefix) => objectKey.startsWith(prefix) && !objectKey.slice(prefix.length).includes("/")
    );
    if (!validAdminKey || !isAllowedMediaObjectKey(objectKey)) {
      throw problem(400, "invalid_media_object", "Media object key is invalid");
    }
  }

  const contentType = String(req.headers["content-type"] ?? "").toLowerCase().split(";")[0].trim();
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  if (!allowedTypes.has(contentType)) {
    throw problem(400, "invalid_avatar_type", "Avatar must be a JPEG, PNG, WebP, HEIC, or HEIF image");
  }
  const declaredSize = Number(req.headers["content-length"] ?? 0);
  if (declaredSize > 10_000_000) {
    throw problem(413, "avatar_too_large", "Avatar image must be 10 MB or smaller");
  }
  const body = await readBinaryBody(req);
  if (!body.length) throw problem(400, "empty_avatar", "Avatar image is empty");
  if (body.length > 10_000_000) {
    throw problem(413, "avatar_too_large", "Avatar image must be 10 MB or smaller");
  }

  await cloudflareMediaBucket.put(objectKey, body, {
    httpMetadata: { contentType },
    customMetadata: {
      actorUserId: auth.userId,
      scope: objectKey.split("/", 1)[0]
    }
  });
  res.goodVibeDeferJson = false;
  res.writeHead(204, {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end();
}

async function serveMockUpload(req, res, url) {
  const isUploadUrl = url.pathname.startsWith("/mock-upload/");
  const prefix = isUploadUrl ? "/mock-upload/" : "/assets/";
  let objectKey;
  try {
    objectKey = decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    throw problem(400, "invalid_upload_key", "Upload key is invalid");
  }
  const upload = mockUploads.get(objectKey);
  if (!upload) throw problem(404, "upload_not_found", "Upload URL was not found");
  if (upload.expiresAt <= Date.now() && upload.body === null) {
    mockUploads.delete(objectKey);
    throw problem(410, "upload_url_expired", "Upload URL has expired");
  }

  if (isUploadUrl && req.method === "PUT") {
    upload.body = await readBinaryBody(req);
    upload.contentType = req.headers["content-type"] || "application/octet-stream";
    res.writeHead(204);
    res.end();
    return;
  }
  if (!isUploadUrl && req.method === "GET") {
    if (upload.body === null) throw problem(404, "upload_not_ready", "File has not been uploaded yet");
    res.writeHead(200, {
      "Content-Type": upload.contentType,
      "Content-Length": upload.body.length,
      "Cache-Control": "public, max-age=3600"
    });
    res.end(upload.body);
    return;
  }
  throw problem(405, "method_not_allowed", "Method not allowed");
}

async function serveAdmin(req, res, url) {
  let filePath = url.pathname === "/" || url.pathname === "/admin" || url.pathname === "/admin/"
    ? path.join(adminDir, "index.html")
    : path.join(adminDir, url.pathname.replace("/admin/", ""));
  if (!isInsideDirectory(adminDir, filePath)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, { error: "asset_not_found" });
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": contentTypeFor(ext) });
  fs.createReadStream(filePath).pipe(res);
}

async function serveStatic(req, res, url, rootDir, prefix, indexName) {
  const relativePath = url.pathname === prefix || url.pathname === `${prefix}/`
    ? indexName
    : url.pathname.replace(`${prefix}/`, "");
  const filePath = path.join(rootDir, relativePath);
  if (!isInsideDirectory(rootDir, filePath)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
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
  if (res.goodVibeDeferJson) {
    res.goodVibePendingJson = { status, payload };
    return;
  }
  writeJson(res, status, payload);
}

function servePaymentReturnBridge(res, url) {
  const requestedStatus = url.searchParams.get("status");
  const status = ["success", "cancel", "pending"].includes(requestedStatus)
    ? requestedStatus
    : "pending";
  const locale = normalizePaymentReturnLocale(url.searchParams.get("locale"));
  const copy = paymentReturnCopy(locale)[status];
  const deepLink = new URL("goodvibe://payment-return");
  deepLink.searchParams.set("status", status);
  deepLink.searchParams.set("locale", locale);
  const sessionId = url.searchParams.get("session_id");
  if (sessionId && sessionId.length <= 255) deepLink.searchParams.set("session_id", sessionId);
  const deepLinkUrl = deepLink.toString();
  const deepLinkHref = escapeHtmlAttribute(deepLinkUrl);
  const nonce = crypto.randomBytes(16).toString("base64");
  const html = `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${copy.title} · Good Vibe Pilates &amp; Yoga</title>
    <style>
      :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #f5f0e9; color: #2e2925; }
      main { width: min(28rem, calc(100% - 3rem)); padding: 2rem; border-radius: 1.5rem; background: #fff; box-shadow: 0 1rem 3rem #392b1c1f; text-align: center; }
      h1 { margin: 0 0 .75rem; font-family: Georgia, serif; font-weight: 500; }
      p { margin: 0 0 1.5rem; line-height: 1.6; color: #625a53; }
      a { display: inline-block; padding: .85rem 1.25rem; border-radius: 999px; background: #8f332d; color: #fff; font-weight: 700; text-decoration: none; }
      @media (prefers-color-scheme: dark) { body { background: #171412; color: #f8f2ea; } main { background: #25211e; } p { color: #cfc3b8; } }
    </style>
  </head>
  <body>
    <main>
      <h1>${copy.title}</h1>
      <p>${copy.message}</p>
      <a href="${deepLinkHref}">${copy.button}</a>
    </main>
    <script nonce="${nonce}">window.setTimeout(function () { window.location.replace(${JSON.stringify(deepLinkUrl)}); }, 50);</script>
  </body>
</html>`;
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(html);
}

function normalizePaymentReturnLocale(value) {
  return ["en", "zh-Hans", "ko"].includes(value) ? value : "en";
}

function paymentReturnCopy(locale) {
  const copy = {
    en: {
      success: {
        title: "Returning to Good Vibe",
        message: "Your payment was submitted. The app will refresh its confirmed status from our server.",
        button: "Open Good Vibe app"
      },
      cancel: {
        title: "Payment not completed",
        message: "No payment confirmation was received. You can return to the app and try again.",
        button: "Return to Good Vibe"
      },
      pending: {
        title: "Checking payment status",
        message: "Open the app to check the latest payment status from our server.",
        button: "Open Good Vibe app"
      }
    },
    "zh-Hans": {
      success: {
        title: "正在返回 Good Vibe",
        message: "付款已提交。应用将从服务器刷新最终确认状态。",
        button: "打开 Good Vibe 应用"
      },
      cancel: {
        title: "付款未完成",
        message: "尚未收到付款确认。您可以返回应用后重试。",
        button: "返回 Good Vibe"
      },
      pending: {
        title: "正在确认付款状态",
        message: "请打开应用，从服务器获取最新付款状态。",
        button: "打开 Good Vibe 应用"
      }
    },
    ko: {
      success: {
        title: "Good Vibe로 돌아가는 중",
        message: "결제가 제출되었습니다. 앱에서 서버의 최종 확인 상태를 새로고침합니다.",
        button: "Good Vibe 앱 열기"
      },
      cancel: {
        title: "결제가 완료되지 않았습니다",
        message: "결제 확인을 받지 못했습니다. 앱으로 돌아가 다시 시도할 수 있습니다.",
        button: "Good Vibe로 돌아가기"
      },
      pending: {
        title: "결제 상태 확인 중",
        message: "앱을 열어 서버의 최신 결제 상태를 확인하세요.",
        button: "Good Vibe 앱 열기"
      }
    }
  };
  return copy[locale];
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function writeJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function persistAndFlush(res) {
  const pending = res.goodVibePendingJson;
  if (!pending) return;
  if (pending.status < 400) {
    await storeRepository.save(store);
    storeLastRefreshedAt = Date.now();
  }
  res.goodVibeDeferJson = false;
  res.goodVibePendingJson = null;
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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Idempotency-Key,Stripe-Signature");
}

function baseUrl() {
  return process.env.APP_BASE_URL
    ?? process.env.RENDER_EXTERNAL_URL
    ?? `http://localhost:${port}`;
}

function paymentReturnUrl(status, locale = "en", { includeCheckoutSession = false } = {}) {
  const url = new URL("/payments/return", `${baseUrl().replace(/\/+$/, "")}/`);
  url.searchParams.set("status", status);
  url.searchParams.set("locale", normalizePaymentReturnLocale(locale));
  if (includeCheckoutSession) url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  return url.toString();
}

function isInsideDirectory(rootDir, candidate) {
  const relative = path.relative(rootDir, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertProductionConfiguration() {
  if (process.env.NODE_ENV !== "production") return;

  const firebaseApiKey = globalThis.__GOOD_VIBE_FIREBASE_WEB_API_KEY__ ?? process.env.FIREBASE_WEB_API_KEY;
  if (String(process.env.AUTH_PROVIDER ?? "local").toLowerCase() === "firebase" && !firebaseApiKey?.trim()) {
    throw new Error("FIREBASE_WEB_API_KEY is required when AUTH_PROVIDER=firebase");
  }

  const required = [
    "APP_BASE_URL",
    "APP_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_MERCHANT_IDENTIFIER",
    "COACH_INVITE_CODE",
    "INITIAL_ADMIN_EMAIL",
    "INITIAL_ADMIN_PASSWORD",
    "LEGAL_OPERATOR_NAME",
    "LEGAL_POSTAL_ADDRESS",
    "PRIVACY_EMAIL",
    "SUPPORT_EMAIL"
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  }
  const cloudProvider = String(process.env.CLOUD_PROVIDER ?? "").toLowerCase();
  if (cloudProvider === "alibaba") {
    const alibabaRequired = [
      "DATABASE_URL",
      "OSS_REGION",
      "OSS_ACCESS_KEY_ID",
      "OSS_ACCESS_KEY_SECRET",
      "OSS_BUCKET",
      "OSS_PUBLIC_BASE_URL"
    ];
    const missingAlibaba = alibabaRequired.filter((name) => !process.env[name]?.trim());
    if (missingAlibaba.length) {
      throw new Error(`Missing Alibaba Cloud production environment variables: ${missingAlibaba.join(", ")}`);
    }
  } else if (!process.env.DATABASE_URL?.trim()) {
    const hasSupabase = process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim();
    if (!hasSupabase) {
      throw new Error("Production persistence requires DATABASE_URL or SUPABASE_URL with SUPABASE_SECRET_KEY");
    }
  }
  if (!process.env.APP_BASE_URL.startsWith("https://")) {
    throw new Error("APP_BASE_URL must use HTTPS in production");
  }
  if (process.env.APP_SECRET.length < 32) {
    throw new Error("APP_SECRET must contain at least 32 characters in production");
  }
  if (process.env.COACH_INVITE_CODE.length < 12) {
    throw new Error("COACH_INVITE_CODE must contain at least 12 characters in production");
  }
  if (process.env.INITIAL_ADMIN_PASSWORD === "GoodVibe@2026" || process.env.INITIAL_ADMIN_PASSWORD.length < 12) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be unique and contain at least 12 characters");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.INITIAL_ADMIN_EMAIL)) {
    throw new Error("INITIAL_ADMIN_EMAIL must be a valid email address");
  }
}

function serveLegalPage(res, pagePath) {
  const operator = escapeHtml(process.env.LEGAL_OPERATOR_NAME ?? "Good Vibe Pilates & Yoga");
  const address = escapeHtml(process.env.LEGAL_POSTAL_ADDRESS ?? "California, United States");
  const privacyEmail = escapeHtml(process.env.PRIVACY_EMAIL ?? "privacy@goodvibepilatesyoga.com");
  const supportEmail = escapeHtml(process.env.SUPPORT_EMAIL ?? "support@goodvibepilatesyoga.com");
  const effectiveDate = escapeHtml(process.env.LEGAL_EFFECTIVE_DATE ?? "July 16, 2026");
  const pages = {
    "/privacy": {
      title: "Privacy Policy",
      body: `<p>We collect account, booking, payment, device, and optional wellness information to operate Good Vibe Pilates & Yoga. Payment card details are processed by Stripe and are not stored by us.</p><p>You may request access, correction, deletion, or restriction from the app. We retain transaction and safety records only where required for legal, accounting, fraud-prevention, or dispute purposes.</p><p>We do not sell personal information. Contact <a href="mailto:${privacyEmail}">${privacyEmail}</a> or write to ${address}.</p>`
    },
    "/privacy-choices": {
      title: "California Privacy Choices",
      body: `<p>California residents may request access, correction, deletion, and limitation of eligible personal information without discriminatory treatment. Submit a request in the app or email <a href="mailto:${privacyEmail}">${privacyEmail}</a>.</p><p>We do not sell or share personal information for cross-context behavioral advertising. If this practice changes, this page will provide an opt-out control.</p>`
    },
    "/terms": {
      title: "Membership & Booking Terms",
      body: `<p>Prices are shown in US dollars. Class passes do not renew automatically unless you separately and affirmatively consent to recurring billing.</p><p>You may cancel renewal or submit a membership cancellation request inside the app. Cancellation and refund eligibility depend on the signed membership agreement and applicable California law. Booking cancellation terms are displayed during booking.</p><p>For support, contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>`
    },
    "/support": {
      title: "App Support",
      body: `<p>For help with your Good Vibe account, class bookings, memberships, payments, refunds, or accessibility, email <a href="mailto:${supportEmail}">${supportEmail}</a>.</p><p>Please include the email address associated with your account and a short description of the issue. Do not send passwords or full payment card details.</p><p>We aim to reply within two business days. You can also manage bookings, request membership cancellation, export your data, or request account deletion directly in the app.</p>`
    }
  };
  const page = pages[pagePath];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${page.title} | ${operator}</title><style>body{font:16px/1.65 system-ui;max-width:760px;margin:auto;padding:32px 20px;color:#252420;background:#faf8f4}h1{line-height:1.15}a{color:#375b52}.meta{color:#6d6a63}</style></head><body><p><a href="/">${operator}</a></p><h1>${page.title}</h1><p class="meta">Effective ${effectiveDate}</p>${page.body}<hr><p class="meta">Operator: ${operator}<br>Mailing address: ${address}</p></body></html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
  res.end(html);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
