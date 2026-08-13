import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../src/api/client.ts", import.meta.url), "utf8");
const studentScreen = readFileSync(new URL("../app/(student)/index.tsx", import.meta.url), "utf8");
const profileScreen = readFileSync(new URL("../app/(student)/profile.tsx", import.meta.url), "utf8");
const paymentGrid = readFileSync(new URL("../src/components/payment-methods-grid.tsx", import.meta.url), "utf8");

test("payment catalog display is complete without weakening checkout eligibility", () => {
  assert.match(client, /allSupported \? "&scope=all" : ""/);
  assert.match(profileScreen, /paymentMethods\(paymentRegion\.country, paymentRegion\.currency, true\)/);
  assert.match(studentScreen, /await paymentMethods\(checkoutRegion\.country, checkoutRegion\.currency\)/);
  assert.doesNotMatch(studentScreen, /PaymentMethodsGrid|allPaymentMethods/);
  assert.match(profileScreen, /accessibilityState=\{\{ expanded: paymentsExpanded \}\}/);
});

test("payment cards expose every supported card-network logo", () => {
  for (const network of ["Visa", "Mastercard", "American Express", "Discover", "JCB", "Diners Club", "UnionPay"]) {
    assert.ok(paymentGrid.includes(`"${network}"`), `missing card-network logo for ${network}`);
  }
  assert.match(paymentGrid, /PaymentMethodLogo code=\{method\.code\}/);
  assert.match(paymentGrid, /method\.code === "card"/);
  assert.match(paymentGrid, /code: "apple_pay"/);
  assert.match(paymentGrid, /code: "google_pay"/);
  assert.doesNotMatch(paymentGrid, /code: "link"/);
  assert.doesNotMatch(paymentGrid, /code: "kr_card"/);
  assert.match(paymentGrid, /assets\/payment\/unionpay\.png/);
  assert.match(paymentGrid, /assets\/payment\/samsung-pay\.png/);
});
