import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/utils/booking.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: "booking.ts",
  reportDiagnostics: true
});
const errors = (transpiled.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"));

const {
  parseBookingIdFromQr,
  pendingBookingsBySession,
  resolveCheckoutPaymentRegion,
  resolvePaymentRegion,
  selectEligibleMemberCard
} = await import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`);

const tokenSource = readFileSync(new URL("../src/theme/tokens.ts", import.meta.url), "utf8");
const tokenTranspiled = ts.transpileModule(tokenSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: "tokens.ts",
  reportDiagnostics: true
});
const tokenErrors = (tokenTranspiled.diagnostics ?? [])
  .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
assert.equal(
  tokenErrors.length,
  0,
  tokenErrors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n")
);
const { darkColors, lightColors } = await import(
  `data:text/javascript;base64,${Buffer.from(tokenTranspiled.outputText).toString("base64")}`
);

const apiErrorSource = readFileSync(new URL("../src/utils/api-error.ts", import.meta.url), "utf8");
const apiErrorTranspiled = ts.transpileModule(apiErrorSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: "api-error.ts",
  reportDiagnostics: true
});
const apiErrorErrors = (apiErrorTranspiled.diagnostics ?? [])
  .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
assert.equal(
  apiErrorErrors.length,
  0,
  apiErrorErrors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n")
);
const { apiErrorTranslationKey, localizedApiError } = await import(
  `data:text/javascript;base64,${Buffer.from(apiErrorTranspiled.outputText).toString("base64")}`
);

test("selectEligibleMemberCard ignores inactive, expired, and insufficient cards", () => {
  const selected = selectEligibleMemberCard([
    { id: "expired", status: "active", expiresAt: "2026-01-01T00:00:00.000Z", remainingCredits: 10 },
    { id: "frozen", status: "frozen", expiresAt: "2027-01-01T00:00:00.000Z", remainingCredits: 10 },
    { id: "insufficient", status: "active", expiresAt: "2026-12-01T00:00:00.000Z", remainingCredits: 1 },
    { id: "usable", status: "active", expiresAt: "2026-11-01T00:00:00.000Z", remainingCredits: 3 }
  ], 2, Date.parse("2026-07-15T00:00:00.000Z"));

  assert.equal(selected?.id, "usable");
});

test("resolvePaymentRegion uses the device region rather than a language", () => {
  assert.deepEqual(resolvePaymentRegion("kr"), { country: "KR", currency: "KRW" });
  assert.deepEqual(resolvePaymentRegion("HK"), { country: "HK", currency: "HKD" });
  assert.deepEqual(resolvePaymentRegion("DE"), { country: "DE", currency: "EUR" });
});

test("checkout keeps the device country but never overwrites the order currency", () => {
  assert.deepEqual(resolveCheckoutPaymentRegion("HK", "krw"), { country: "HK", currency: "KRW" });
  assert.deepEqual(resolveCheckoutPaymentRegion("KR", "HKD"), { country: "KR", currency: "HKD" });
  assert.deepEqual(resolveCheckoutPaymentRegion("KR", undefined), { country: "KR", currency: "KRW" });
});

test("pending bookings are indexed by session for payment recovery", () => {
  const pending = pendingBookingsBySession([
    { id: "confirmed", courseSessionId: "session-1", status: "confirmed" },
    { id: "pending", courseSessionId: "session-1", status: "pending_payment", orderId: "order-1" },
    { id: "cancelled", courseSessionId: "session-2", status: "cancelled" }
  ]);

  assert.equal(pending.get("session-1")?.id, "pending");
  assert.equal(pending.has("session-2"), false);
});

test("parseBookingIdFromQr supports raw IDs, JSON, and URLs", () => {
  assert.equal(parseBookingIdFromQr("bkg_raw_123"), "bkg_raw_123");
  assert.equal(parseBookingIdFromQr('{"bookingId":"bkg_json_123"}'), "bkg_json_123");
  assert.equal(parseBookingIdFromQr('{"booking":{"id":"bkg_nested_123"}}'), "bkg_nested_123");
  assert.equal(parseBookingIdFromQr("goodvibe://check-in?bookingId=bkg_url_123"), "bkg_url_123");
  assert.equal(parseBookingIdFromQr("yomiyoga://booking/bkg_host_123"), "bkg_host_123");
  assert.equal(parseBookingIdFromQr("yomiyoga://bookings/bkg_hosts_123"), "bkg_hosts_123");
  assert.equal(parseBookingIdFromQr("https://example.com/bookings/bkg_path_123/check-in"), "bkg_path_123");
  assert.equal(parseBookingIdFromQr("https://example.com/?id=bkg_untrusted_123"), null);
  assert.equal(parseBookingIdFromQr("not a booking id"), null);
});

test("light and dark themes expose matching semantic color tokens", () => {
  assert.deepEqual(Object.keys(darkColors).sort(), Object.keys(lightColors).sort());
  for (const key of ["background", "surface", "text", "muted", "line", "accentSoft"]) {
    assert.notEqual(darkColors[key], lightColors[key], `${key} must change with the selected theme`);
  }
});

test("English, Simplified Chinese, and Korean expose the same translation keys", () => {
  const i18nSource = readFileSync(new URL("../src/i18n/index.ts", import.meta.url), "utf8");
  const lines = i18nSource.split(/\r?\n/);
  const starts = lines
    .map((line, index) => /^\s+translation:\s*\{/.test(line) ? index : -1)
    .filter((index) => index >= 0);
  const keySets = starts.map((start) => {
    const keys = [];
    for (let index = start + 1; index < lines.length && !/^\s{6}\}/.test(lines[index]); index += 1) {
      const match = lines[index].match(/^\s{8}([A-Za-z][A-Za-z0-9]*):/);
      if (match) keys.push(match[1]);
    }
    return keys.sort();
  });

  assert.equal(keySets.length, 3);
  assert.deepEqual(keySets[1], keySets[0]);
  assert.deepEqual(keySets[2], keySets[0]);
  for (const requiredKey of [
    "studentDataErrorTitle",
    "coachDataErrorTitle",
    "staffDataErrorTitle",
    "adminMobileAdministration",
    "adminAuditHistory",
    "queryErrorMessage"
  ]) {
    assert.equal(keySets[0].includes(requiredKey), true, `Missing translation key: ${requiredKey}`);
  }
});

test("API failures are mapped to localized, user-safe messages", () => {
  assert.equal(apiErrorTranslationKey({ code: "invalid_credentials", status: 401 }), "invalidCredentials");
  assert.equal(apiErrorTranslationKey({ code: "checkin_too_early", status: 409 }), "checkInUnavailable");
  assert.equal(apiErrorTranslationKey({ code: "refund_amount_exceeds_remaining", status: 409 }), "invalidRefundAmount");
  assert.equal(apiErrorTranslationKey({ status: 0 }), "networkError");
  assert.equal(apiErrorTranslationKey(new Error("internal detail")), "requestFailed");
  assert.equal(localizedApiError({ code: "session_full" }, (key) => `translated:${key}`), "translated:classFull");
});
