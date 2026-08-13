import assert from "node:assert/strict";
import {
  cancelBooking,
  createBooking,
  createPrivacyRequest,
  createSeedStore,
  deleteAccount,
  DEMO_PASSWORD,
  enforceFixedAdminAccount,
  exportPrivacyData,
  getPaymentMethods,
  hardenProductionStore,
  login,
  loginWithFirebaseUser,
  prepareFirebaseRegistration,
  repairOperationalState,
  register,
  registerFirebaseUser,
  requestMembershipCancellation,
  resendEmailVerification,
  ROLES,
  verifyEmailRegistration
} from "../apps/api/src/domain.js";
import { signToken, verifyToken } from "../apps/api/src/auth.js";

const store = createSeedStore();

const studentLogin = login(store, {
  email: "student@example.com",
  password: DEMO_PASSWORD,
  role: ROLES.STUDENT,
  locale: "en"
}, signToken);

const studentAuth = {
  sessionId: studentLogin.session.id,
  userId: studentLogin.user.id,
  activeRole: ROLES.STUDENT,
  locale: "en"
};

assert.equal(studentLogin.session.activeRole, ROLES.STUDENT);
assert.equal(verifyToken(studentLogin.token, store).activeRole, ROLES.STUDENT);

{
  const operationalStore = createSeedStore();
  delete operationalStore.courses[0].active;
  operationalStore.products[0].active = false;
  operationalStore.courseSessions[0].startsAt = "2026-01-01T08:00:00.000Z";
  operationalStore.courseSessions[0].endsAt = "2026-01-01T09:00:00.000Z";
  operationalStore.courseSessions[0].status = "open";
  const repaired = repairOperationalState(operationalStore, Date.parse("2026-07-26T00:00:00.000Z"));
  assert.equal(repaired, true);
  assert.equal(operationalStore.courses[0].active, true);
  assert.equal(operationalStore.products[0].active, false);
  assert.equal(operationalStore.courseSessions[0].status, "closed");
}

assert.throws(() => login(store, {
  identifier: "+14155550101",
  password: DEMO_PASSWORD,
  role: ROLES.STUDENT,
  locale: "en"
}, signToken), /Email, password, and a valid role are required/);

{
  const firebaseStore = createSeedStore();
  const registration = prepareFirebaseRegistration(firebaseStore, {
    name: "Firebase Member",
    email: "firebase.member@example.com",
    password: "YogaFlow2026",
    role: ROLES.STUDENT,
    locale: "en"
  });
  const pending = registerFirebaseUser(firebaseStore, registration, "firebase-uid-1");
  assert.equal(pending.verificationMethod, "link");
  assert.equal(firebaseStore.authIdentities.at(-1).passwordHash, undefined);
  assert.throws(
    () => loginWithFirebaseUser(firebaseStore, {
      uid: "firebase-uid-1",
      email: registration.email,
      emailVerified: false
    }, { role: ROLES.STUDENT, locale: "en" }, signToken),
    (error) => error?.status === 403 && error?.code === "email_not_verified"
  );
  const authenticated = loginWithFirebaseUser(firebaseStore, {
    uid: "firebase-uid-1",
    email: registration.email,
    emailVerified: true
  }, { role: ROLES.STUDENT, locale: "en" }, signToken);
  assert.equal(authenticated.user.email, registration.email);
  assert.equal(authenticated.session.activeRole, ROLES.STUDENT);
  assert.equal(firebaseStore.authIdentities.at(-1).verifiedAt !== null, true);

  assert.throws(
    () => prepareFirebaseRegistration(firebaseStore, {
      name: "Coach Without Invite",
      email: "coach.no.invite@example.com",
      password: "YogaFlow2026",
      role: ROLES.COACH,
      locale: "en"
    }, { coachInviteCode: "test-coach-invite-2026" }),
    (error) => error?.status === 403 && error?.code === "invalid_coach_invite_code"
  );
  const coachRegistration = prepareFirebaseRegistration(firebaseStore, {
    name: "Invited Coach",
    email: "invited.coach@example.com",
    password: "YogaFlow2026",
    role: ROLES.COACH,
    locale: "en",
    inviteCode: "test-coach-invite-2026"
  }, { coachInviteCode: "test-coach-invite-2026" });
  registerFirebaseUser(firebaseStore, coachRegistration, "firebase-coach-1");
  const coachUser = firebaseStore.users.at(-1);
  assert.deepEqual(coachUser.roles, [ROLES.COACH]);
  assert.equal(firebaseStore.coaches.at(-1).userId, coachUser.id);
}

{
  const registrationStore = createSeedStore();
  const registered = register(registrationStore, {
    name: "Lin Yue",
    identifier: "lin.yue@example.com",
    password: "YogaFlow2026",
    role: ROLES.STUDENT,
    locale: "zh-Hans"
  }, signToken);
  assert.equal(registered.response.email, "lin.yue@example.com");
  assert.equal(registered.response.requiresVerification, true);
  assert.match(registered.delivery.code, /^\d{6}$/);
  assert.throws(() => login(registrationStore, {
    identifier: "lin.yue@example.com",
    password: "YogaFlow2026",
    role: ROLES.STUDENT,
    locale: "zh-Hans"
  }, signToken), /Verify your email/);
  assert.throws(() => verifyEmailRegistration(registrationStore, {
    email: registered.response.email,
    code: "000000",
    locale: "zh-Hans"
  }, signToken), /incorrect/);
  registrationStore.emailVerificationChallenges.at(-1).createdAt = new Date(Date.now() - 61_000).toISOString();
  const resent = resendEmailVerification(registrationStore, {
    email: registered.response.email,
    password: "YogaFlow2026"
  });
  assert.match(resent.delivery.code, /^\d{6}$/);
  const verified = verifyEmailRegistration(registrationStore, {
    email: registered.response.email,
    code: resent.delivery.code,
    locale: "zh-Hans"
  }, signToken);
  assert.equal(verified.user.email, registered.response.email);
  assert.equal(login(registrationStore, {
    identifier: "lin.yue@example.com",
    password: "YogaFlow2026",
    role: ROLES.STUDENT,
    locale: "zh-Hans"
  }, signToken).user.id, verified.user.id);
  assert.throws(() => register(registrationStore, {
    name: "Second User",
    identifier: "lin.yue@example.com",
    password: "YogaFlow2026",
    role: ROLES.STUDENT
  }, signToken), /already registered/);
  assert.throws(() => register(registrationStore, {
    name: "Unsafe Admin",
    identifier: "unsafe-admin@example.com",
    password: "YogaFlow2026",
    role: ROLES.ADMIN
  }, signToken), /cannot be registered/);
  const invitedCoach = register(registrationStore, {
    name: "Invited Coach",
    identifier: "invited.local.coach@example.com",
    password: "YogaFlow2026",
    role: ROLES.COACH,
    inviteCode: "test-coach-invite-2026"
  }, signToken, { coachInviteCode: "test-coach-invite-2026" });
  assert.equal(
    registrationStore.users.find((user) => user.id === invitedCoach.userId).roles[0],
    ROLES.COACH
  );
}

{
  const invariantStore = createSeedStore();
  invariantStore.users.push({
    id: "usr_extra_admin",
    name: "Extra Admin",
    email: "extra.admin@example.com",
    locale: "en",
    roles: [ROLES.STUDENT, ROLES.ADMIN]
  });
  invariantStore.roleSessions.push({
    id: "ses_extra_admin",
    userId: "usr_extra_admin",
    activeRole: ROLES.ADMIN,
    locale: "en",
    revokedAt: null
  });
  assert.equal(enforceFixedAdminAccount(invariantStore), true);
  assert.deepEqual(invariantStore.users.at(-1).roles, [ROLES.STUDENT]);
  assert.ok(invariantStore.roleSessions.at(-1).revokedAt);
  assert.deepEqual(
    invariantStore.users.filter((user) => user.roles.includes(ROLES.ADMIN)).map((user) => user.id),
    ["usr_admin"]
  );
}

const firstBooking = createBooking(store, studentAuth, {
  courseSessionId: "sess_flow_1",
  paymentMode: "member_card"
}, "test-booking-1");

assert.equal(firstBooking.booking.status, "confirmed");
assert.equal(store.memberCards[0].remainingCredits, 9);
assert.equal(store.courseSessions[0].bookedCount, 1);

const duplicateBooking = createBooking(store, studentAuth, {
  courseSessionId: "sess_flow_1",
  paymentMode: "member_card"
}, "test-booking-1");

assert.equal(duplicateBooking.booking.id, firstBooking.booking.id);
assert.equal(store.memberCards[0].remainingCredits, 9);
assert.equal(store.courseSessions[0].bookedCount, 1);

cancelBooking(store, studentAuth, firstBooking.booking.id, "test_cancel");
assert.equal(store.bookings[0].status, "cancelled");
assert.equal(store.memberCards[0].remainingCredits, 10);
assert.equal(store.courseSessions[0].bookedCount, 0);

const krwMethods = getPaymentMethods({ country: "KR", currency: "KRW" }).map((method) => method.code);
assert.ok(krwMethods.includes("card"));
assert.ok(krwMethods.includes("kakao_pay"));
assert.ok(krwMethods.includes("naver_pay"));
assert.ok(krwMethods.includes("samsung_pay"));
assert.ok(krwMethods.includes("payco"));

const hkdMethods = getPaymentMethods({ country: "HK", currency: "HKD" }).map((method) => method.code);
assert.ok(hkdMethods.includes("card"));
assert.ok(hkdMethods.includes("alipay"));
assert.ok(hkdMethods.includes("wechat_pay"));

const localizedCard = getPaymentMethods({ country: "HK", currency: "HKD" })
  .find((method) => method.code === "card");
assert.equal(localizedCard.display["zh-Hans"], "银行卡");
assert.equal(localizedCard.display.ko, "카드");

assert.deepEqual(
  getPaymentMethods({ all: true }).map((method) => method.code),
  ["card", "paypal", "alipay", "wechat_pay", "kakao_pay", "naver_pay", "samsung_pay", "payco"]
);

assert.throws(() => login(store, {
  email: "student@example.com",
  password: DEMO_PASSWORD,
  role: ROLES.STAFF,
  locale: "en"
}, signToken), /User cannot log in as staff/);

assert.throws(() => login(store, {
  email: "student@example.com",
  password: "wrong-password",
  role: ROLES.STUDENT,
  locale: "en"
}, signToken), /Email or password is incorrect/);

{
  const roleStore = createSeedStore();
  const roleLogin = login(roleStore, {
    email: "student@example.com",
    password: DEMO_PASSWORD,
    role: ROLES.STUDENT,
    locale: "en"
  }, signToken);
  roleStore.users.find((user) => user.id === roleLogin.user.id).roles = [ROLES.STAFF];
  assert.throws(
    () => verifyToken(roleLogin.token, roleStore),
    (error) => error?.status === 401 && error?.code === "role_revoked"
  );
}

{
  const californiaStore = createSeedStore();
  const auth = { userId: "usr_student", activeRole: ROLES.STUDENT, sessionId: "privacy_test" };
  assert.deepEqual(
    getPaymentMethods().map((method) => method.code),
    ["card", "paypal"]
  );
  const privacyRequest = createPrivacyRequest(californiaStore, auth, { type: "access" });
  assert.equal(privacyRequest.status, "pending");
  assert.equal(exportPrivacyData(californiaStore, auth).user.id, "usr_student");
  const cancellation = requestMembershipCancellation(californiaStore, auth, "card_student_10");
  assert.equal(cancellation.request.status, "pending");
  assert.equal(cancellation.card.autoRenew, false);
  const deleted = deleteAccount(californiaStore, auth);
  assert.equal(deleted.ok, true);
  assert.equal(californiaStore.authIdentities.some((item) => item.userId === "usr_student"), false);
  assert.equal(californiaStore.bodyMetrics.some((item) => item.userId === "usr_student"), false);
}

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
try {
  const productionStore = createSeedStore();
  assert.equal(hardenProductionStore(productionStore, {
    adminEmail: "owner@goodvibe.test",
    adminPassword: "UniqueProductionPassword!"
  }), true);
  assert.equal(productionStore.authIdentities.length, 1);
  assert.equal(productionStore.authIdentities[0].value, "owner@goodvibe.test");
  assert.throws(() => login(productionStore, {
    email: "admin@example.com",
    password: DEMO_PASSWORD,
    role: ROLES.ADMIN,
    locale: "en"
  }, signToken), /Email or password is incorrect/);
  assert.equal(login(productionStore, {
    email: "owner@goodvibe.test",
    password: "UniqueProductionPassword!",
    role: ROLES.ADMIN,
    locale: "en"
  }, signToken).user.id, "usr_admin");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
}

console.log("domain tests passed");
