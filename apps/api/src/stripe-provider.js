import crypto from "node:crypto";
import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-02-25.clover";

export async function createStripePaymentIntent({
  amount,
  currency,
  methodCode,
  orderId,
  customerEmail,
  returnUrl,
  idempotencyKey
}) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const mockId = `pi_mock_${crypto.randomBytes(8).toString("hex")}`;
    return {
      mode: "mock",
      paymentIntentId: mockId,
      clientSecret: `${mockId}_secret_mock`,
      nextActionUrl: methodRequiresRedirect(methodCode) ? returnUrl : null
    };
  }

  return stripeOperation(() => stripeClient(secretKey).paymentIntents.create({
    amount,
    currency: currency.toLowerCase(),
    ...(orderId ? { metadata: { order_id: orderId } } : {}),
    automatic_payment_methods: { enabled: true },
    ...(customerEmail ? { receipt_email: customerEmail } : {})
  }, requestOptions(idempotencyKey)));
}

export async function createStripePaymentSheet({
  amount,
  currency,
  methodCode,
  orderId,
  customerEmail,
  merchantIdentifier = process.env.STRIPE_MERCHANT_IDENTIFIER ?? "merchant.com.goodvibe.pilatesyoga",
  idempotencyKey
}) {
  const paymentIntent = await createStripePaymentIntent({
    amount,
    currency,
    methodCode,
    orderId,
    customerEmail,
    idempotencyKey
  });

  if (paymentIntent.mode === "mock") {
    const customerId = `cus_mock_${crypto.randomBytes(8).toString("hex")}`;
    return {
      mode: "mock",
      paymentIntentId: paymentIntent.paymentIntentId,
      paymentIntentClientSecret: paymentIntent.clientSecret,
      customerId,
      ephemeralKeySecret: `ephkey_mock_${crypto.randomBytes(8).toString("hex")}`,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "pk_test_mock",
      merchantIdentifier
    };
  }

  return {
    mode: "live",
    paymentIntentId: paymentIntent.id,
    paymentIntentClientSecret: paymentIntent.client_secret,
    customerId: null,
    ephemeralKeySecret: null,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    merchantIdentifier
  };
}

export async function createStripeCheckoutSession({
  amount,
  currency,
  methodCode,
  orderId,
  productName,
  customerEmail,
  successUrl,
  cancelUrl,
  idempotencyKey
}) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const mockId = `cs_mock_${crypto.randomBytes(8).toString("hex")}`;
    return {
      mode: "mock",
      checkoutSessionId: mockId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      url: appendQueryParams(successUrl, {
        session_id: mockId,
        mock: "true"
      })
    };
  }

  return stripeOperation(() => stripeClient(secretKey).checkout.sessions.create({
    mode: "payment",
    origin_context: "mobile_app",
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(orderId ? {
      client_reference_id: orderId,
      metadata: { order_id: orderId },
      payment_intent_data: { metadata: { order_id: orderId } }
    } : {}),
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    line_items: [{
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: amount,
        product_data: { name: productName ?? "Good Vibe Pilates & Yoga" }
      },
      quantity: 1
    }]
  }, requestOptions(idempotencyKey)));
}

export async function createStripeRefund({
  paymentIntentId,
  chargeId,
  amount,
  reason,
  idempotencyKey
}) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      mode: "mock",
      id: `re_mock_${crypto.randomBytes(8).toString("hex")}`,
      amount,
      status: "succeeded"
    };
  }

  if (!paymentIntentId && !chargeId) {
    throw providerInputError("A Stripe payment intent or charge is required for refunds");
  }
  const stripeReason = ["duplicate", "fraudulent", "requested_by_customer"].includes(reason)
    ? reason
    : "requested_by_customer";
  return stripeOperation(() => stripeClient(secretKey).refunds.create({
    ...(paymentIntentId ? { payment_intent: paymentIntentId } : { charge: chargeId }),
    amount,
    reason: stripeReason,
    ...(reason && reason !== stripeReason ? { metadata: { internal_reason: String(reason) } } : {})
  }, requestOptions(idempotencyKey)));
}

export function verifyStripeWebhook(
  rawBody,
  signatureHeader,
  secret = process.env.STRIPE_WEBHOOK_SECRET,
  { toleranceSeconds = 300, now = Date.now() } = {}
) {
  const payload = normalizeWebhookPayload(rawBody);
  if (!secret) {
    if (process.env.STRIPE_SECRET_KEY?.trim()) {
      throw webhookProblem(
        "stripe_webhook_secret_missing",
        "Stripe webhook verification is unavailable because STRIPE_WEBHOOK_SECRET is not configured",
        503
      );
    }
    return parseWebhookPayload(payload);
  }
  if (!signatureHeader) {
    throw webhookProblem("invalid_stripe_signature", "Missing Stripe-Signature header");
  }

  let timestampValue = null;
  const signatures = [];
  for (const rawPart of String(signatureHeader).split(",")) {
    const separatorIndex = rawPart.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = rawPart.slice(0, separatorIndex).trim();
    const value = rawPart.slice(separatorIndex + 1).trim();
    if (key === "t" && timestampValue === null) timestampValue = value;
    if (key === "v1") signatures.push(value);
  }

  if (!timestampValue || !/^\d+$/.test(timestampValue) || signatures.length === 0) {
    throw webhookProblem("invalid_stripe_signature", "Invalid Stripe-Signature header");
  }
  const timestamp = Number(timestampValue);
  const currentSeconds = Math.floor(Number(now) / 1000);
  if (!Number.isSafeInteger(timestamp) || !Number.isFinite(currentSeconds)) {
    throw webhookProblem("invalid_stripe_signature", "Invalid Stripe webhook timestamp");
  }
  if (
    !Number.isFinite(toleranceSeconds)
    || toleranceSeconds < 0
    || Math.abs(currentSeconds - timestamp) > toleranceSeconds
  ) {
    throw webhookProblem("stripe_webhook_timestamp_expired", "Stripe webhook timestamp is outside the allowed tolerance");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestampValue}.${payload}`)
    .digest();
  const hasValidSignature = signatures.some((signature) => {
    if (!/^[a-f\d]{64}$/i.test(signature)) return false;
    const actual = Buffer.from(signature, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  });
  if (!hasValidSignature) {
    throw webhookProblem("invalid_stripe_signature", "Invalid Stripe webhook signature");
  }
  return parseWebhookPayload(payload);
}

function methodRequiresRedirect(methodCode) {
  return [
    "alipay",
    "wechat_pay",
    "kakao_pay",
    "naver_pay",
    "samsung_pay",
    "payco"
  ].includes(methodCode);
}

function stripeClient(secretKey) {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    telemetry: false
  });
}

function requestOptions(idempotencyKey) {
  return idempotencyKey ? { idempotencyKey } : {};
}

async function stripeOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error?.code === "stripe_error") throw error;
    const wrapped = new Error(error?.message ?? "Stripe request failed");
    wrapped.status = 502;
    wrapped.code = "stripe_error";
    wrapped.stripe = error?.raw ?? null;
    throw wrapped;
  }
}

function appendQueryParams(value, params) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw providerInputError("Checkout success URL must be an absolute URL", "invalid_checkout_url");
  }
  for (const [key, paramValue] of Object.entries(params)) {
    url.searchParams.set(key, paramValue);
  }
  return url.toString();
}

function normalizeWebhookPayload(rawBody) {
  if (typeof rawBody === "string") return rawBody;
  if (Buffer.isBuffer(rawBody)) return rawBody.toString("utf8");
  return String(rawBody ?? "");
}

function parseWebhookPayload(payload) {
  try {
    return JSON.parse(payload || "{}");
  } catch {
    throw webhookProblem("invalid_webhook_payload", "Stripe webhook payload must be valid JSON");
  }
}

function webhookProblem(code, message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function providerInputError(message, code = "invalid_refund_request") {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}
