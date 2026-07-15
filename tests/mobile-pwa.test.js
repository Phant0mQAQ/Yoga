import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("apps/mobile/index.html", "utf8");
const script = fs.readFileSync("apps/mobile/app.js", "utf8");
const styles = fs.readFileSync("apps/mobile/styles.css", "utf8");

const messagesStart = script.indexOf("const messages = ");
const messagesEnd = script.indexOf("\n\nconst $", messagesStart);
assert.notEqual(messagesStart, -1, "PWA translation dictionary is missing");
assert.notEqual(messagesEnd, -1, "PWA translation dictionary boundary is missing");

const dictionarySource = script
  .slice(messagesStart, messagesEnd)
  .replace("const messages =", "messages =");
const context = {};
vm.runInNewContext(dictionarySource, context);
const messages = context.messages;

assert.deepEqual(Object.keys(messages).sort(), ["en", "ko", "zh-Hans"]);
const englishKeys = Object.keys(messages.en).sort();
for (const locale of ["zh-Hans", "ko"]) {
  assert.deepEqual(
    Object.keys(messages[locale]).sort(),
    englishKeys,
    `${locale} PWA translation keys must match English`
  );
}

for (const key of [
  "language",
  "darkMode",
  "lightMode",
  "demoPassword",
  "weekStreak",
  "todayAtGoodVibe",
  "teachingDay",
  "sessions",
  "confirmed",
  "arrived",
  "frontDesk",
  "readyForArrivals",
  "arrivalsMeta",
  "account",
  "goodVibeMembership",
  "left",
  "classFull",
  "noEligibleCard",
  "reserving",
  "checkingIn",
  "bookingConfirmed",
  "checkInComplete",
  "alreadyBooked",
  "checkInNotEligible",
  "requestFailed",
  "signingIn",
  "retry",
  "dataLoadFailed",
  "active",
  "checkedIn",
  "pendingPayment"
]) {
  for (const locale of ["en", "zh-Hans", "ko"]) {
    assert.ok(messages[locale][key], `missing ${locale} translation for ${key}`);
  }
}

assert.equal(messages["zh-Hans"].frontDesk, "前台");
assert.equal(messages.ko.frontDesk, "프런트 데스크");

const renderedSource = script.slice(messagesEnd);
for (const hardcodedText of [
  "Demo password:",
  "Today at Good Vibe",
  "Your teaching day.",
  "Ready for arrivals",
  "Scan a booking QR code",
  "GOOD VIBE MEMBERSHIP"
]) {
  assert.equal(
    renderedSource.includes(hardcodedText),
    false,
    `rendered PWA source contains hardcoded English: ${hardcodedText}`
  );
}

assert.match(script, /const THEME_STORAGE_KEY = "good-vibe-mobile-theme"/);
assert.match(script, /localStorage\.setItem\(THEME_STORAGE_KEY, state\.theme\)/);
assert.match(script, /matchMedia\?\.\("\(prefers-color-scheme: dark\)"\)/);
assert.match(script, /document\.documentElement\.dataset\.theme = state\.theme/);
assert.match(script, /id="themeToggle"/);
assert.match(script, /paymentRegion: preferredPaymentRegion\(\)/);
assert.match(script, /const \{ country, currency \} = state\.paymentRegion/);
assert.equal(
  /state\.locale === "ko" \? "KR"/.test(script),
  false,
  "payment region must not be inferred from the selected UI language"
);
assert.equal(
  /state\.paymentRegion\s*=/.test(script),
  false,
  "language changes must not overwrite the device payment region"
);
assert.match(script, /copy\("todayAtGoodVibe"\)/);
assert.match(script, /copy\("frontDesk"\)/);
assert.match(script, /copy\("account"\)/);
assert.match(script, /copy\("goodVibeMembership"\)/);
assert.match(script, /copy\("left"\)/);
assert.match(script, /copy\("classFull"\)/);
assert.match(script, /copy\("noEligibleCard"\)/);
assert.match(script, /statusLabel\(card\.status\)/);
assert.match(script, /statusLabel\(booking\.status\)/);
assert.match(script, /document\.documentElement\.lang = state\.locale/);
assert.doesNotMatch(script, /const card = state\.data\.cards\[0\]/);
assert.match(script, /pendingBookings: new Set\(\)/);
assert.match(script, /pendingCheckIns: new Set\(\)/);
assert.match(script, /if \(state\.pendingBookings\.has\(sessionId\)\) return/);
assert.match(script, /if \(state\.pendingCheckIns\.has\(bookingId\)\) return/);
assert.match(script, /return booking\.status === "confirmed"/);
assert.doesNotMatch(
  script,
  /\["confirmed", "pending_payment"\]\.includes\(booking\.status\)/,
  "pending-payment bookings must remain visible but cannot be checked in"
);
assert.doesNotMatch(script, /booking\.status !== "checked_in"/);
assert.match(script, /state\.status = localizePwaError\(error\)/);
assert.match(script, /role="status" aria-live="polite"/);
assert.match(script, /id="retryLoad"/);
assert.match(script, /async function retryDataLoad\(\)/);
assert.doesNotMatch(script, /api\(`\/bookings\?locale=\$\{state\.locale\}`\)\.catch/);
assert.doesNotMatch(script, /api\("\/member-cards"\)\.catch/);
assert.match(
  script,
  /state\.busy = true;\s+state\.status = "";\s+render\(\);/,
  "login must render its busy state immediately and clear stale errors"
);

assert.match(html, /good-vibe-mobile-theme/);
assert.match(html, /prefers-color-scheme: dark/);
assert.match(html, /good-vibe-icon-192\.png/);
assert.match(styles, /:root\[data-theme="dark"\]/);
assert.match(styles, /html\[data-theme="dark"\] \{ color-scheme: dark; \}/);
assert.match(styles, /\.theme-toggle/);
assert.match(styles, /--nav-bg:/);

const paymentRegionStart = script.indexOf("function preferredPaymentRegion");
const paymentRegionEnd = script.indexOf("\n\nfunction toggleTheme", paymentRegionStart);
assert.notEqual(paymentRegionStart, -1, "device payment-region inference is missing");
assert.notEqual(paymentRegionEnd, -1, "device payment-region inference boundary is missing");
const paymentContext = {};
vm.runInNewContext(script.slice(paymentRegionStart, paymentRegionEnd), paymentContext);
const paymentRegionFor = (locales) => JSON.parse(JSON.stringify(
  paymentContext.paymentRegionForLocales(locales)
));

assert.deepEqual(paymentRegionFor(["ko-KR", "en-US"]), { country: "KR", currency: "KRW" });
assert.deepEqual(paymentRegionFor(["en", "zh-HK"]), { country: "HK", currency: "HKD" });
assert.deepEqual(paymentRegionFor(["zh-CN"]), { country: "CN", currency: "CNY" });
assert.deepEqual(paymentRegionFor(["de-DE"]), { country: "DE", currency: "EUR" });
assert.deepEqual(paymentRegionFor(["pt-BR"]), { country: "BR", currency: "USD" });
assert.deepEqual(paymentRegionFor([]), { country: "HK", currency: "HKD" });
assert.deepEqual(paymentRegionFor(["_"]), { country: "HK", currency: "HKD" });

const eligibilityStart = script.indexOf("function bookingCreditCost");
const eligibilityEnd = script.indexOf("\n\nfunction eligibleCardForSession", eligibilityStart);
assert.notEqual(eligibilityStart, -1, "booking credit-cost helper is missing");
assert.notEqual(eligibilityEnd, -1, "card eligibility helper boundary is missing");
const eligibilityContext = {};
vm.runInNewContext(script.slice(eligibilityStart, eligibilityEnd), eligibilityContext);

const session = { course: { memberCardDeductCount: 2 } };
assert.equal(eligibilityContext.bookingCreditCost(session), 2);
assert.equal(eligibilityContext.bookingCreditCost({ course: { memberCardDeductCount: 0 } }), 1);

const now = Date.parse("2026-07-15T00:00:00.000Z");
assert.equal(eligibilityContext.isEligibleCard({
  status: "active",
  remainingCredits: 2,
  expiresAt: "2026-07-16T00:00:00.000Z"
}, 2, now), true);
assert.equal(eligibilityContext.isEligibleCard({
  status: "frozen",
  remainingCredits: 20,
  expiresAt: "2026-07-16T00:00:00.000Z"
}, 2, now), false);
assert.equal(eligibilityContext.isEligibleCard({
  status: "active",
  remainingCredits: 1,
  expiresAt: "2026-07-16T00:00:00.000Z"
}, 2, now), false);
assert.equal(eligibilityContext.isEligibleCard({
  status: "active",
  remainingCredits: 20,
  expiresAt: "2026-07-14T00:00:00.000Z"
}, 2, now), false);

const checkInStart = script.indexOf("function isCheckInEligible");
const checkInEnd = script.indexOf("\n\nfunction bookingListMarkup", checkInStart);
assert.notEqual(checkInStart, -1, "check-in eligibility helper is missing");
assert.notEqual(checkInEnd, -1, "check-in eligibility helper boundary is missing");
const checkInContext = {};
vm.runInNewContext(script.slice(checkInStart, checkInEnd), checkInContext);
assert.equal(checkInContext.isCheckInEligible({ status: "confirmed" }), true);
assert.equal(checkInContext.isCheckInEligible({ status: "pending_payment" }), false);
assert.equal(checkInContext.isCheckInEligible({ status: "cancelled" }), false);
assert.equal(checkInContext.isCheckInEligible({ status: "checked_in" }), false);
assert.match(
  script,
  /state\.data\.bookings\.map\(\(booking\) =>/,
  "all bookings, including pending-payment bookings, must still render in the list"
);

console.log("mobile PWA theme and localization tests passed");
