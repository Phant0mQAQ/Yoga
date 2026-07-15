import crypto from "node:crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
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

  const payload = new URLSearchParams();
  payload.set("amount", String(amount));
  payload.set("currency", currency.toLowerCase());
  payload.set("metadata[order_id]", orderId ?? "");
  payload.set("automatic_payment_methods[enabled]", "false");
  payload.append("payment_method_types[]", stripeMethodCode(methodCode));
  if (customerEmail) payload.set("receipt_email", customerEmail);

  return stripeRequest("/payment_intents", payload, secretKey, { idempotencyKey });
}

export async function createStripePaymentSheet({
  amount,
  currency,
  methodCode,
  orderId,
  customerEmail,
  merchantIdentifier = process.env.STRIPE_MERCHANT_IDENTIFIER ?? "merchant.com.yomiyoga.studio",
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

  const payload = new URLSearchParams();
  payload.set("mode", "payment");
  payload.set("success_url", successUrl);
  payload.set("cancel_url", cancelUrl);
  payload.set("metadata[order_id]", orderId ?? "");
  payload.append("payment_method_types[]", stripeMethodCode(methodCode));
  payload.set("line_items[0][price_data][currency]", currency.toLowerCase());
  payload.set("line_items[0][price_data][unit_amount]", String(amount));
  payload.set("line_items[0][price_data][product_data][name]", productName ?? "Good Vibe Pilates & Yoga");
  payload.set("line_items[0][quantity]", "1");

  return stripeRequest("/checkout/sessions", payload, secretKey, { idempotencyKey });
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

  const payload = new URLSearchParams();
  if (paymentIntentId) payload.set("payment_intent", paymentIntentId);
  else if (chargeId) payload.set("charge", chargeId);
  else throw providerInputError("A Stripe payment intent or charge is required for refunds");
  payload.set("amount", String(amount));
  const stripeReason = ["duplicate", "fraudulent", "requested_by_customer"].includes(reason)
    ? reason
    : "requested_by_customer";
  payload.set("reason", stripeReason);
  if (reason && reason !== stripeReason) payload.set("metadata[internal_reason]", String(reason));

  return stripeRequest("/refunds", payload, secretKey, { idempotencyKey });
}

export function verifyStripeWebhook(
  rawBody,
  signatureHeader,
  secret = process.env.STRIPE_WEBHOOK_SECRET,
  { toleranceSeconds = 300, now = Date.now() } = {}
) {
  const payload = normalizeWebhookPayload(rawBody);
  if (!secret) return parseWebhookPayload(payload);
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

export function stripeMethodCode(methodCode) {
  if (methodCode === "card" || methodCode === "apple_pay") return "card";
  return methodCode;
}

function methodRequiresRedirect(methodCode) {
  return [
    "alipay",
    "wechat_pay",
    "kr_card",
    "kakao_pay",
    "naver_pay",
    "samsung_pay",
    "payco"
  ].includes(methodCode);
}

async function stripeRequest(path, payload, secretKey, { idempotencyKey } = {}) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: payload
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message ?? `Stripe request failed with ${response.status}`;
    const err = new Error(message);
    err.status = 502;
    err.code = "stripe_error";
    err.stripe = data;
    throw err;
  }
  return data;
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

function webhookProblem(code, message) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}

function providerInputError(message, code = "invalid_refund_request") {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}
