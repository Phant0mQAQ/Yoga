import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  applyStripeEvent,
  cancelBooking,
  checkInBooking,
  createBooking,
  createOrder,
  createPaymentRecord,
  createSeedStore,
  getPaymentMethods,
  memberCardOperation,
  prepareRefund,
  recordRefund,
  repairKnownTranslations,
  rescheduleBooking,
  ROLES,
  validatePaymentRequest
} from "../apps/api/src/domain.js";
import {
  createStripeCheckoutSession,
  createStripePaymentIntent,
  createStripePaymentSheet,
  createStripeRefund,
  verifyStripeWebhook
} from "../apps/api/src/stripe-provider.js";

const studentAuth = { userId: "usr_student", activeRole: ROLES.STUDENT, sessionId: "test_student" };
const adminAuth = { userId: "usr_admin", activeRole: ROLES.ADMIN, sessionId: "test_admin" };
const staffAuth = { userId: "usr_staff", activeRole: ROLES.STAFF, sessionId: "test_staff" };
const coachAuth = { userId: "usr_coach", activeRole: ROLES.COACH, sessionId: "test_coach" };

{
  const store = createSeedStore();
  const initialStock = store.products[0].stock;
  assertProblem(() => createOrder(store, studentAuth, {
    items: [
      { productId: "prod_mat", quantity: 1 },
      { productId: "prod_mat", quantity: -2 }
    ]
  }, "negative-order"), "invalid_quantity");
  assert.equal(store.products[0].stock, initialStock);
  assert.equal(store.orders.length, 0);

  const created = createOrder(store, studentAuth, {
    items: [{ productId: "prod_mat", quantity: 1 }]
  }, "valid-order");
  assert.equal(created.order.totalAmount, 4200);
  assert.equal(store.products[0].stock, initialStock - 1);

  assertProblem(() => validatePaymentRequest(store, studentAuth, {
    orderId: created.order.id,
    amount: 1,
    currency: "KRW",
    country: "KR",
    methodCode: "card"
  }), "payment_amount_mismatch");
  assertProblem(() => validatePaymentRequest(store, studentAuth, {
    amount: 0,
    currency: "KRW",
    country: "KR",
    methodCode: "card"
  }), "invalid_payment_amount");

  const payment = createPaymentRecord(store, studentAuth, {
    orderId: created.order.id,
    amount: created.order.totalAmount,
    currency: created.order.currency,
    country: "KR",
    methodCode: "card",
    providerPayload: { paymentIntentId: "pi_financial_test" }
  });
  assertProblem(() => prepareRefund(store, payment.id), "payment_not_refundable");
  const unknownEvent = applyStripeEvent(store, {
    id: "evt_financial_unknown",
    type: "customer.updated",
    data: { object: { id: "cus_financial_test" } }
  });
  assert.equal(unknownEvent.applied, false);
  assert.equal(unknownEvent.reason, "unsupported_event_type");
  assert.equal(store.stripeEvents.length, 0);
  assert.equal(payment.webhookEventId, null);

  const failedEvent = {
    id: "evt_financial_failed",
    type: "payment_intent.payment_failed",
    data: { object: { id: "pi_financial_test" } }
  };
  assert.equal(applyStripeEvent(store, failedEvent).applied, true);
  assert.equal(payment.status, "failed");
  assert.equal(store.stripeEvents.length, 1);

  assert.equal(applyStripeEvent(store, {
    id: "evt_financial_success",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_financial_test", latest_charge: "ch_financial_test" } }
  }).applied, true);
  assert.equal(payment.status, "succeeded");
  assert.equal(created.order.status, "refund_required");
  assert.equal(payment.refundStatus, "refund_required");
  assert.equal(store.stripeEvents.length, 2);
  const replayedOldEvent = applyStripeEvent(store, failedEvent);
  assert.equal(replayedOldEvent.applied, false);
  assert.equal(payment.status, "succeeded");
  assert.equal(store.stripeEvents.length, 2);
  assert.equal(applyStripeEvent(store, {
    id: "evt_financial_late_failed",
    type: "payment_intent.payment_failed",
    data: { object: { id: "pi_financial_test" } }
  }).applied, true);
  assert.equal(payment.status, "succeeded");
  assert.equal(store.stripeEvents.length, 3);
  assertProblem(() => prepareRefund(store, payment.id, -5), "invalid_refund_amount");
  assertProblem(() => prepareRefund(store, payment.id, 4201), "refund_amount_exceeds_remaining");

  const partial = recordRefund(store, payment.id, {
    amount: 1000,
    providerRefundId: "re_partial",
    status: "succeeded"
  });
  assert.equal(partial.payment.status, "succeeded");
  assert.equal(partial.payment.refundStatus, "partially_refunded");
  assert.equal(prepareRefund(store, payment.id).amount, 3200);

  const completed = recordRefund(store, payment.id, {
    amount: 3200,
    providerRefundId: "re_remaining",
    status: "succeeded"
  });
  assert.equal(completed.payment.status, "refunded");
  assert.equal(completed.payment.refundStatus, "refunded");
  assert.equal(applyStripeEvent(store, {
    id: "evt_financial_late_success",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_financial_test" } }
  }).applied, true);
  assert.equal(payment.status, "refunded");
  assert.equal(payment.refundStatus, "refunded");
  assertProblem(() => prepareRefund(store, payment.id), "payment_not_refundable");
}

{
  const store = createSeedStore();
  const pending = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "payment"
  }, "pending-checkin-booking");
  assert.equal(pending.booking.status, "pending_payment");
  assertProblem(
    () => checkInBooking(store, staffAuth, pending.booking.id),
    "not_checkin_eligible"
  );

  const payment = createPaymentRecord(store, studentAuth, {
    orderId: pending.order.id,
    amount: pending.order.totalAmount,
    currency: pending.order.currency,
    country: "KR",
    methodCode: "card",
    providerPayload: { paymentIntentId: "pi_checkin_payment" }
  });
  applyStripeEvent(store, {
    id: "evt_checkin_payment_succeeded",
    type: "payment_intent.succeeded",
    data: { object: { id: payment.stripePaymentIntentId } }
  });
  assert.equal(pending.booking.status, "confirmed");

  store.coaches.push({ id: "coach_other", userId: "usr_other_coach", name: "Other Coach" });
  assertProblem(
    () => checkInBooking(store, {
      userId: "usr_other_coach",
      activeRole: ROLES.COACH,
      sessionId: "test_other_coach"
    }, pending.booking.id),
    "coach_booking_forbidden"
  );
  assert.equal(checkInBooking(store, coachAuth, pending.booking.id).booking.status, "checked_in");
}

{
  const store = createSeedStore();
  const pending = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "payment"
  }, "refunded-before-success-booking");
  const payment = createPaymentRecord(store, studentAuth, {
    orderId: pending.order.id,
    amount: pending.order.totalAmount,
    currency: pending.order.currency,
    country: "KR",
    methodCode: "card",
    providerPayload: { paymentIntentId: "pi_refunded_before_success" }
  });
  applyStripeEvent(store, {
    id: "evt_refunded_before_success",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_refunded_before_success",
        payment_intent: payment.stripePaymentIntentId,
        amount: payment.amount,
        amount_refunded: payment.amount
      }
    }
  });
  applyStripeEvent(store, {
    id: "evt_late_success_after_refund",
    type: "payment_intent.succeeded",
    data: { object: { id: payment.stripePaymentIntentId } }
  });
  assert.equal(payment.status, "refunded");
  assert.equal(pending.order.status, "refunded");
  assert.equal(pending.booking.status, "cancelled");
  assertProblem(() => checkInBooking(store, staffAuth, pending.booking.id), "not_checkin_eligible");
}

{
  const store = createSeedStore();
  const pending = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "payment"
  }, "async-checkout-booking");
  const payment = createPaymentRecord(store, studentAuth, {
    orderId: pending.order.id,
    amount: pending.order.totalAmount,
    currency: pending.order.currency,
    country: "KR",
    methodCode: "card",
    providerPayload: { checkoutSessionId: "cs_async_checkout" }
  });
  applyStripeEvent(store, {
    id: "evt_async_checkout_completed",
    type: "checkout.session.completed",
    data: {
      object: {
        id: payment.stripeCheckoutSessionId,
        payment_intent: "pi_async_checkout"
      }
    }
  });
  assert.equal(payment.status, "processing");
  assert.equal(pending.booking.status, "pending_payment");
  applyStripeEvent(store, {
    id: "evt_async_checkout_succeeded",
    type: "checkout.session.async_payment_succeeded",
    data: { object: { id: payment.stripeCheckoutSessionId, payment_intent: "pi_async_checkout" } }
  });
  assert.equal(payment.status, "succeeded");
  assert.equal(pending.order.status, "paid");
  assert.equal(pending.booking.status, "confirmed");
}

{
  const store = createSeedStore();
  const created = createOrder(store, studentAuth, {
    items: [{ productId: "prod_mat", quantity: 1 }]
  }, "stripe-charge-refund-order");
  const payment = createPaymentRecord(store, studentAuth, {
    orderId: created.order.id,
    amount: created.order.totalAmount,
    currency: created.order.currency,
    country: "KR",
    methodCode: "card",
    providerPayload: { paymentIntentId: "pi_charge_refund" }
  });
  applyStripeEvent(store, {
    id: "evt_charge_refund_success",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_charge_refund", latest_charge: "ch_charge_refund" } }
  });

  applyStripeEvent(store, {
    id: "evt_charge_refund_partial_without_list",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_charge_refund",
        payment_intent: "pi_charge_refund",
        amount: 4200,
        amount_refunded: 1000
      }
    }
  });
  assert.equal(payment.status, "succeeded");
  assert.equal(payment.refundStatus, "partially_refunded");
  assert.equal(store.refunds.length, 0);
  assert.equal(prepareRefund(store, payment.id).amount, 3200);

  applyStripeEvent(store, {
    id: "evt_charge_refund_partial_with_list",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_charge_refund",
        payment_intent: "pi_charge_refund",
        amount: 4200,
        amount_refunded: 1000,
        refunds: {
          data: [{
            id: "re_charge_partial",
            amount: 1000,
            currency: "usd",
            status: "succeeded",
            reason: "requested_by_customer"
          }]
        }
      }
    }
  });
  assert.equal(store.refunds.length, 1);
  assert.equal(store.refunds[0].providerRefundId, "re_charge_partial");

  applyStripeEvent(store, {
    id: "evt_charge_refund_full",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_charge_refund",
        payment_intent: "pi_charge_refund",
        amount: 4200,
        amount_refunded: 4200,
        refunds: {
          data: [
            { id: "re_charge_partial", amount: 1000, currency: "usd", status: "succeeded" },
            { id: "re_charge_remaining", amount: 3200, currency: "usd", status: "succeeded" }
          ]
        }
      }
    }
  });
  assert.equal(payment.status, "refunded");
  assert.equal(payment.refundStatus, "refunded");
  assert.equal(store.refunds.length, 2);

  applyStripeEvent(store, {
    id: "evt_charge_refund_stale_partial",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_charge_refund",
        payment_intent: "pi_charge_refund",
        amount: 4200,
        amount_refunded: 1000,
        refunds: {
          data: [{ id: "re_charge_partial", amount: 1000, currency: "usd", status: "pending" }]
        }
      }
    }
  });
  assert.equal(payment.status, "refunded");
  assert.equal(payment.refundStatus, "refunded");
  assert.equal(store.refunds.find((refund) => refund.providerRefundId === "re_charge_partial").status, "succeeded");
}

{
  const store = createSeedStore();
  const booking = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "member_card"
  }, "booking-one");
  assertProblem(() => createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "member_card"
  }, "booking-two"), "duplicate_booking");
  assert.equal(store.bookings.length, 1);
  assert.equal(store.courseSessions[0].bookedCount, 1);
  assert.equal(store.memberCards[0].remainingCredits, 9);

  rescheduleBooking(store, studentAuth, booking.booking.id, "sess_private_1");
  assert.equal(store.memberCards[0].remainingCredits, 8);
  assert.equal(store.cardTransactions.at(-1).credits, -1);
  rescheduleBooking(store, studentAuth, booking.booking.id, "sess_flow_1");
  assert.equal(store.memberCards[0].remainingCredits, 9);
  assert.equal(store.cardTransactions.at(-1).credits, 1);
  cancelBooking(store, studentAuth, booking.booking.id, "test_complete");
  assert.equal(store.memberCards[0].remainingCredits, 10);
}

{
  const store = createSeedStore();
  const expiredCard = store.memberCards[0];
  expiredCard.expiresAt = new Date(Date.now() - 60_000).toISOString();
  store.memberCards.push({
    ...expiredCard,
    id: "card_student_valid",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    remainingCredits: 10
  });
  const booking = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "member_card"
  }, "valid-card-selection");
  assert.equal(booking.booking.memberCardId, "card_student_valid");
  assert.equal(expiredCard.remainingCredits, 10);
}

{
  const store = createSeedStore();
  const card = store.memberCards[0];
  assertProblem(() => memberCardOperation(store, adminAuth, card.id, "upgrade", { addCredits: -20 }), "invalid_credit_amount");
  assert.equal(card.totalCredits, 10);
  assert.equal(card.remainingCredits, 10);
}

{
  const store = createSeedStore();
  const course = store.courses.find((item) => item.id === "course_flow");
  const customDescription = {
    en: "Is this class suitable?",
    "zh-Hans": "这个课程合适吗？",
    ko: "이 수업이 적합한가요?"
  };
  course.description = structuredClone(customDescription);
  repairKnownTranslations(store);
  assert.deepEqual(course.description, customDescription);
}

{
  const brazilMethods = getPaymentMethods({ country: "BR", currency: "USD" }).map((method) => method.code);
  assert.ok(!brazilMethods.includes("alipay"));
  assert.ok(!brazilMethods.includes("wechat_pay"));
  const germanyMethods = getPaymentMethods({ country: "DE", currency: "EUR" }).map((method) => method.code);
  assert.ok(germanyMethods.includes("alipay"));
  assert.ok(germanyMethods.includes("wechat_pay"));
}

{
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  let captured;
  process.env.STRIPE_SECRET_KEY = "sk_test_financial_invariants";
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ id: "re_live_test", amount: 1200, status: "succeeded" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const refund = await createStripeRefund({
      paymentIntentId: "pi_live_test",
      amount: 1200,
      reason: "requested_by_customer",
      idempotencyKey: "refund-live-test"
    });
    assert.equal(refund.id, "re_live_test");
    assert.equal(captured.url, "https://api.stripe.com/v1/refunds");
    assert.equal(new Headers(captured.options.headers).get("idempotency-key"), "refund-live-test");
    assert.equal(new Headers(captured.options.headers).get("stripe-version"), "2026-02-25.clover");
    const payload = new URLSearchParams(captured.options.body);
    assert.equal(payload.get("payment_intent"), "pi_live_test");
    assert.equal(payload.get("amount"), "1200");

    await createStripePaymentIntent({
      amount: 4200,
      currency: "KRW",
      methodCode: "card",
      orderId: "ord_live_intent",
      customerEmail: "student@example.com",
      idempotencyKey: "payment-intent-live-test"
    });
    assert.equal(captured.url, "https://api.stripe.com/v1/payment_intents");
    assert.equal(new Headers(captured.options.headers).get("idempotency-key"), "payment-intent-live-test");
    const intentPayload = new URLSearchParams(captured.options.body);
    assert.equal(intentPayload.get("automatic_payment_methods[enabled]"), "true");
    assert.equal(intentPayload.has("payment_method_types[]"), false);

    await createStripeCheckoutSession({
      amount: 4200,
      currency: "KRW",
      methodCode: "card",
      orderId: "ord_live_checkout",
      customerEmail: "student@example.com",
      productName: "Good Vibe Pilates & Yoga",
      successUrl: "https://example.com/payments/return?status=success&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://example.com/payments/return?status=cancel",
      idempotencyKey: "checkout-live-test"
    });
    assert.equal(captured.url, "https://api.stripe.com/v1/checkout/sessions");
    assert.equal(new Headers(captured.options.headers).get("idempotency-key"), "checkout-live-test");
    const checkoutPayload = new URLSearchParams(captured.options.body);
    assert.equal(checkoutPayload.get("origin_context"), "mobile_app");
    assert.equal(checkoutPayload.get("client_reference_id"), "ord_live_checkout");
    assert.equal(checkoutPayload.get("metadata[order_id]"), "ord_live_checkout");
    assert.equal(checkoutPayload.get("payment_intent_data[metadata][order_id]"), "ord_live_checkout");
    assert.equal(checkoutPayload.get("customer_email"), "student@example.com");
    assert.equal(checkoutPayload.has("payment_method_types[]"), false);

    await createStripeCheckoutSession({
      amount: 100,
      currency: "USD",
      methodCode: "card",
      productName: "Good Vibe configuration test",
      successUrl: "https://example.com/payments/return?status=success&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://example.com/payments/return?status=cancel",
      idempotencyKey: "checkout-standalone-live-test"
    });
    const standaloneCheckoutPayload = new URLSearchParams(captured.options.body);
    assert.equal(standaloneCheckoutPayload.has("client_reference_id"), false);
    assert.equal(standaloneCheckoutPayload.has("metadata[order_id]"), false);
    assert.equal(standaloneCheckoutPayload.has("payment_intent_data[metadata][order_id]"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
  }
}

{
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalMerchantIdentifier = process.env.STRIPE_MERCHANT_IDENTIFIER;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_MERCHANT_IDENTIFIER;
  try {
    const paymentSheet = await createStripePaymentSheet({
      amount: 4200,
      currency: "KRW",
      methodCode: "card",
      orderId: "ord_mock_sheet",
      customerEmail: "student@example.com"
    });
    assert.equal(paymentSheet.merchantIdentifier, "merchant.com.goodvibe.pilatesyoga");

    const checkout = await createStripeCheckoutSession({
      amount: 4200,
      currency: "KRW",
      methodCode: "card",
      orderId: "ord_mock_checkout",
      productName: "Good Vibe Pilates & Yoga",
      successUrl: "goodvibe://payment-return?status=success",
      cancelUrl: "goodvibe://payment-return?status=cancel"
    });
    const checkoutUrl = new URL(checkout.url);
    assert.equal(checkoutUrl.searchParams.get("status"), "success");
    assert.equal(checkoutUrl.searchParams.get("session_id"), checkout.checkoutSessionId);
    assert.equal(checkoutUrl.searchParams.get("mock"), "true");
    await assert.rejects(
      createStripeCheckoutSession({
        amount: 4200,
        currency: "KRW",
        methodCode: "card",
        orderId: "ord_bad_checkout",
        successUrl: "/relative-return",
        cancelUrl: "https://example.com/cancel"
      }),
      (error) => error?.code === "invalid_checkout_url"
    );
  } finally {
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalMerchantIdentifier === undefined) delete process.env.STRIPE_MERCHANT_IDENTIFIER;
    else process.env.STRIPE_MERCHANT_IDENTIFIER = originalMerchantIdentifier;
  }
}

{
  const secret = "whsec_financial_invariants";
  const now = 1_800_000_000_000;
  const timestamp = Math.floor(now / 1000);
  const payload = JSON.stringify({ id: "evt_signed", type: "payment_intent.succeeded" });
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const verified = verifyStripeWebhook(
    payload,
    `t=${timestamp},v1=not-a-valid-signature,v1=${signature}`,
    secret,
    { now }
  );
  assert.equal(verified.id, "evt_signed");

  assertProblem(() => verifyStripeWebhook(
    payload,
    `t=${timestamp - 301},v1=${signature}`,
    secret,
    { now }
  ), "stripe_webhook_timestamp_expired");
  assertProblem(() => verifyStripeWebhook(
    payload,
    `t=${timestamp},v1=abc`,
    secret,
    { now }
  ), "invalid_stripe_signature");

  const malformedPayload = "{not-json";
  const malformedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${malformedPayload}`)
    .digest("hex");
  assertProblem(() => verifyStripeWebhook(
    malformedPayload,
    `t=${timestamp},v1=${malformedSignature}`,
    secret,
    { now }
  ), "invalid_webhook_payload");
  assertProblem(() => verifyStripeWebhook(malformedPayload, null, ""), "invalid_webhook_payload");

  const originalStripeSecret = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_webhook_requires_signature";
  try {
    assertProblem(
      () => verifyStripeWebhook(payload, null, "", { now }),
      "stripe_webhook_secret_missing"
    );
  } finally {
    if (originalStripeSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalStripeSecret;
  }
}

{
  const store = createSeedStore();
  const sharedKey = "same-client-key-different-users";
  const studentBooking = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "payment"
  }, sharedKey);
  const staffBooking = createBooking(store, adminAuth, {
    userId: "usr_staff",
    courseSessionId: "sess_flow_1",
    paymentMode: "payment"
  }, sharedKey);
  assert.notEqual(studentBooking.booking.id, staffBooking.booking.id);
  assert.equal(studentBooking.booking.userId, "usr_student");
  assert.equal(staffBooking.booking.userId, "usr_staff");
  assertProblem(() => createBooking(store, adminAuth, {
    userId: "usr_missing",
    courseSessionId: "sess_flow_1",
    paymentMode: "payment"
  }, "ghost-booking"), "user_not_found");
}

{
  const store = createSeedStore();
  const session = store.courseSessions.find((item) => item.id === "sess_flow_1");
  session.startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  session.endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  assertProblem(() => createBooking(store, studentAuth, {
    courseSessionId: session.id,
    paymentMode: "member_card"
  }, "past-session-booking"), "session_started");
}

{
  const store = createSeedStore();
  const originalCard = store.memberCards.find((card) => card.userId === "usr_student");
  originalCard.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  store.memberCards.push({
    id: "card_earliest_expiry",
    userId: "usr_student",
    planId: originalCard.planId,
    status: "active",
    totalCredits: 5,
    remainingCredits: 5,
    activatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });
  const created = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "member_card"
  }, "earliest-card-booking");
  assert.equal(created.booking.memberCardId, "card_earliest_expiry");
  assert.equal(created.booking.memberCardCreditsUsed, 1);
  const course = store.courses.find((item) => item.id === created.booking.courseId);
  course.memberCardDeductCount = 4;
  cancelBooking(store, studentAuth, created.booking.id);
  assert.equal(store.memberCards.find((card) => card.id === "card_earliest_expiry").remainingCredits, 5);

  const second = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "member_card"
  }, "transfer-block-booking");
  assertProblem(() => memberCardOperation(store, adminAuth, second.booking.memberCardId, "transfer", {
    toUserId: "usr_staff"
  }), "card_has_active_bookings");
  cancelBooking(store, studentAuth, second.booking.id);
  const transferred = memberCardOperation(store, adminAuth, second.booking.memberCardId, "transfer", {
    toUserId: "usr_staff"
  });
  assert.equal(transferred.card.userId, "usr_staff");
  assert.equal(transferred.card.status, "active");
}

{
  const store = createSeedStore();
  const card = store.memberCards.find((item) => item.userId === "usr_student");
  card.status = "frozen";
  card.frozenUntil = new Date(Date.now() - 1000).toISOString();
  const created = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "member_card"
  }, "auto-unfreeze-card");
  assert.equal(created.booking.memberCardId, card.id);
  assert.equal(card.status, "active");
}

{
  const store = createSeedStore();
  const created = createBooking(store, studentAuth, {
    courseSessionId: "sess_flow_1",
    paymentMode: "member_card"
  }, "checkin-window-booking");
  created.booking.startsAt = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
  created.booking.endsAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
  assertProblem(() => checkInBooking(store, staffAuth, created.booking.id), "checkin_too_early");
  created.booking.startsAt = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  created.booking.endsAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  assertProblem(() => checkInBooking(store, staffAuth, created.booking.id), "checkin_window_closed");
}

console.log("financial invariant tests passed");

function assertProblem(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}
