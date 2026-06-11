import assert from "node:assert/strict";
import {
  cancelBooking,
  createBooking,
  createSeedStore,
  DEMO_PASSWORD,
  getPaymentMethods,
  hardenProductionStore,
  login,
  ROLES
} from "../apps/api/src/domain.js";
import { signToken } from "../apps/api/src/auth.js";

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
assert.ok(krwMethods.includes("kr_card"));
assert.ok(krwMethods.includes("kakao_pay"));
assert.ok(krwMethods.includes("naver_pay"));
assert.ok(krwMethods.includes("samsung_pay"));
assert.ok(krwMethods.includes("payco"));

const hkdMethods = getPaymentMethods({ country: "HK", currency: "HKD" }).map((method) => method.code);
assert.ok(hkdMethods.includes("card"));
assert.ok(hkdMethods.includes("alipay"));
assert.ok(hkdMethods.includes("wechat_pay"));
assert.ok(!hkdMethods.includes("kr_card"));

const localizedCard = getPaymentMethods({ country: "HK", currency: "HKD" })
  .find((method) => method.code === "card");
assert.equal(localizedCard.display["zh-Hans"], "国际银行卡");
assert.equal(localizedCard.display.ko, "해외 카드");

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

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
try {
  const productionStore = createSeedStore();
  assert.equal(hardenProductionStore(productionStore, {
    adminEmail: "owner@yomiyoga.test",
    adminPassword: "UniqueProductionPassword!"
  }), true);
  assert.equal(productionStore.authIdentities.length, 1);
  assert.equal(productionStore.authIdentities[0].value, "owner@yomiyoga.test");
  assert.throws(() => login(productionStore, {
    email: "admin@example.com",
    password: DEMO_PASSWORD,
    role: ROLES.ADMIN,
    locale: "en"
  }, signToken), /Email or password is incorrect/);
  assert.equal(login(productionStore, {
    email: "owner@yomiyoga.test",
    password: "UniqueProductionPassword!",
    role: ROLES.ADMIN,
    locale: "en"
  }, signToken).user.id, "usr_admin");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
}

console.log("domain tests passed");
