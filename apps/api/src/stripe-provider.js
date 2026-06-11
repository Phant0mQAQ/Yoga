import crypto from "node:crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export async function createStripePaymentIntent({
  amount,
  currency,
  methodCode,
  orderId,
  customerEmail,
  returnUrl
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

  return stripeRequest("/payment_intents", payload, secretKey);
}

export async function createStripePaymentSheet({
  amount,
  currency,
  methodCode,
  orderId,
  customerEmail,
  merchantIdentifier = process.env.STRIPE_MERCHANT_IDENTIFIER ?? "merchant.com.yogabooking"
}) {
  const paymentIntent = await createStripePaymentIntent({
    amount,
    currency,
    methodCode,
    orderId,
    customerEmail
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
  cancelUrl
}) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const mockId = `cs_mock_${crypto.randomBytes(8).toString("hex")}`;
    return {
      mode: "mock",
      checkoutSessionId: mockId,
      url: `${successUrl}?session_id=${mockId}&mock=true`
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
  payload.set("line_items[0][price_data][product_data][name]", productName ?? "Yoga booking");
  payload.set("line_items[0][quantity]", "1");

  return stripeRequest("/checkout/sessions", payload, secretKey);
}

export function verifyStripeWebhook(rawBody, signatureHeader, secret = process.env.STRIPE_WEBHOOK_SECRET) {
  if (!secret) {
    return JSON.parse(rawBody || "{}");
  }
  if (!signatureHeader) {
    throw new Error("Missing Stripe-Signature header");
  }
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  const timestamp = parts.t;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const actual = parts.v1;
  if (!actual || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    throw new Error("Invalid Stripe webhook signature");
  }
  return JSON.parse(rawBody || "{}");
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

async function stripeRequest(path, payload, secretKey) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
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
