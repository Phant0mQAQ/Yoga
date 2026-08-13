import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("apps/mobile/index.html", "utf8");
const script = fs.readFileSync("apps/mobile/app.js", "utf8");
const styles = fs.readFileSync("apps/mobile/styles.css", "utf8");
const expoApiClient = fs.readFileSync("apps/mobile-expo/src/api/client.ts", "utf8");

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
  "refresh",
  "dataLoadFailed",
  "changeProfilePhoto",
  "uploadingProfilePhoto",
  "avatarUpdated",
  "avatarTooLarge",
  "invalidAvatarType",
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
assert.match(script, /api\("\/payments\/methods\?scope=all"\)/);
assert.match(script, /function paymentMethodIcon\(code\)/);
assert.match(script, /function paymentMethodsForDisplay\(methods\)/);
assert.match(script, /<details class="payment-disclosure">/);
const studentHomeSource = script.slice(script.indexOf("function studentContent()"), script.indexOf("function coachContent()"));
assert.doesNotMatch(studentHomeSource, /method-grid|copy\("paymentMethods"\)/);
assert.match(script, /code: "apple_pay"/);
assert.match(script, /code: "google_pay"/);
assert.doesNotMatch(script, /code: "link"/);
assert.doesNotMatch(script, /code: "kr_card"/);
assert.match(script, /function cardNetworkLogos\(\)/);
for (const network of ["Visa", "Mastercard", "American Express", "Discover", "JCB", "Diners Club", "UnionPay"]) {
  assert.ok(script.includes(network), `missing card-network logo for ${network}`);
}
assert.match(script, /unionpay\.svg/);
assert.match(script, /\/app\/assets\/payment\//);
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
assert.match(script, /id="refreshData"/);
assert.match(script, /async function retryDataLoad\(\)/);
assert.match(script, /async function refreshDataSilently\(\)/);
assert.match(script, /window\.addEventListener\("focus"/);
assert.match(script, /document\.addEventListener\("visibilitychange"/);
assert.match(script, /window\.setInterval/);
assert.match(script, /home\.recommendedCourses/);
assert.match(script, /home\.storeRecommendations/);
assert.match(script, /function courseCatalogCard\(course\)/);
assert.match(script, /function contentCard\(block\)/);
assert.match(script, /function productCard\(product\)/);
assert.match(
  script,
  /state\.status = copy\("requestSubmitted"\);\s+await loadData\(\);\s+render\(\);/,
  "membership cancellation success must render the refreshed status"
);
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
assert.match(styles, /\.metric strong \{[^}]*color: var\(--ink\)/);
assert.match(styles, /\.class-card:not\(\.featured\)[^}]*color: var\(--ink\)/);
assert.match(script, /function courseImageMarkup\(course\)/);
assert.match(script, /error\.code = "invalid_response"/);
assert.doesNotMatch(
  expoApiClient,
  /data = \{ message: rawBody \}/,
  "Expo must not render HTML upstream error pages as API error messages"
);
assert.match(expoApiClient, /"invalid_response"/);
assert.match(script, /course\?\.imageUrl/);
assert.match(script, /if \(!candidate\) return "";/);
assert.match(styles, /\.course-image \{/);
assert.match(script, /function attendeeAvatar\(person\)/);
assert.match(script, /person\?\.avatarUrl/);
assert.match(script, /<img src="\$\{escapeHtml\(avatarUrl\)\}" alt="" loading="lazy"/);
assert.match(script, /id="avatarFile" class="visually-hidden" type="file"/);
assert.match(script, /accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif"/);
assert.match(script, /async function uploadProfilePhoto\(file\)/);
assert.match(script, /api\("\/me\/avatar-upload"/);
assert.match(script, /method: "PUT"/);
assert.match(script, /api\("\/me\/avatar"/);
assert.match(styles, /\.profile-avatar \{/);
assert.match(styles, /\.avatar img \{/);
assert.match(styles, /\.catalog-grid \{/);
assert.match(styles, /\.editorial-card \{/);

const sessionMetricsStart = script.indexOf("function isSessionFull");
const sessionMetricsEnd = script.indexOf("\n\nfunction hasActiveBookingForSession", sessionMetricsStart);
assert.notEqual(sessionMetricsStart, -1, "session metric helpers are missing");
assert.notEqual(sessionMetricsEnd, -1, "session metric helper boundary is missing");
const sessionMetricsContext = {};
vm.runInNewContext(script.slice(sessionMetricsStart, sessionMetricsEnd), sessionMetricsContext);
const metricNow = Date.parse("2026-07-26T00:00:00.000Z");
assert.equal(sessionMetricsContext.isSessionBookable({
  status: "open",
  startsAt: "2026-07-27T00:00:00.000Z",
  capacity: 8,
  participantCount: 2
}, metricNow), true);
assert.equal(sessionMetricsContext.isSessionBookable({
  status: "open",
  startsAt: "2026-07-27T00:00:00.000Z",
  capacity: 1,
  participantCount: 1
}, metricNow), false);
assert.equal(sessionMetricsContext.countUpcomingBookings([
  { status: "confirmed", endsAt: "2026-07-27T00:00:00.000Z" },
  { status: "cancelled", endsAt: "2026-07-27T00:00:00.000Z" },
  { status: "confirmed", endsAt: "2026-07-25T00:00:00.000Z" }
], metricNow), 1);

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
assert.deepEqual(paymentRegionFor([]), { country: "US", currency: "USD" });
assert.deepEqual(paymentRegionFor(["_"]), { country: "US", currency: "USD" });

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
