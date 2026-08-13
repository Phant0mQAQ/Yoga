import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("apps/admin/index.html", "utf8");
const script = fs.readFileSync("apps/admin/app.js", "utf8");
const styles = fs.readFileSync("apps/admin/styles.css", "utf8");
const config = fs.readFileSync("apps/admin/build.mjs", "utf8");
const sourceConfig = fs.readFileSync("apps/admin/config.js", "utf8");

assert.match(html, /<meta charset="utf-8">/);
assert.match(html, /<option value="zh-Hans">简体中文<\/option>/);
assert.match(html, /<option value="ko">한국어<\/option>/);

for (const corruptedText of ["绠", "浣", "頃", "鈫", "锟", "\uFFFD"]) {
  assert.equal(html.includes(corruptedText), false, `index.html contains corrupted text: ${corruptedText}`);
  assert.equal(script.includes(corruptedText), false, `app.js contains corrupted text: ${corruptedText}`);
}

const messagesStart = script.indexOf("const messages = ");
const messagesEnd = script.indexOf("\n\nconst viewMeta", messagesStart);
assert.notEqual(messagesStart, -1, "translation dictionary is missing");
assert.notEqual(messagesEnd, -1, "translation dictionary boundary is missing");

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
    `${locale} translation keys must match English`
  );
}

const htmlTranslationKeys = [
  ...html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)
].map((match) => match[1]);
for (const key of htmlTranslationKeys) {
  assert.ok(messages.en[key], `missing English translation for ${key}`);
  assert.ok(messages["zh-Hans"][key], `missing Simplified Chinese translation for ${key}`);
  assert.ok(messages.ko[key], `missing Korean translation for ${key}`);
}

assert.equal(
  /api\(\s*[`"']\/api\/v1/.test(script),
  false,
  "API calls must be relative to the configured /api/v1 base URL"
);
assert.match(config, /endsWith\("\/api\/v1"\)/);
assert.match(sourceConfig, /apiBaseUrl:\s*"\/api\/v1"/);
assert.match(html, /id="themeBtn"/);
assert.match(html, /id="logoutBtn"/);
assert.equal([...html.matchAll(/data-view="([^"]+)"/g)].length, 6);
for (const view of ["overview", "members", "schedule", "content", "commerce", "settings"]) {
  assert.match(html, new RegExp(`data-view="${view}"`));
  assert.match(script, new RegExp(`${view}: \\[`));
}
assert.match(script, /THEME_STORAGE_KEY/);
assert.match(script, /async function logout\(\)/);
assert.match(script, /\/admin\/members/);
assert.match(script, /\/admin\/member-cards/);
assert.match(script, /\/admin\/content-blocks/);
assert.match(script, /\/admin\/membership-plans/);
assert.match(script, /\/admin\/uploads\/presign/);
assert.match(script, /\/admin\/payments\/\$\{encodeURIComponent\(id\)\}\/refunds/);
assert.match(script, /\/payments\/methods\?scope=all/);
const overviewStart = script.indexOf("async function renderOverview");
const overviewEnd = script.indexOf("\n\nasync function renderMembers", overviewStart);
assert.notEqual(overviewStart, -1, "overview renderer is missing");
assert.notEqual(overviewEnd, -1, "overview renderer boundary is missing");
const overviewSource = script.slice(overviewStart, overviewEnd);
assert.doesNotMatch(overviewSource, /payments\/methods|overview-payments|paymentMethodsForDisplay/);
assert.match(
  overviewSource,
  /item\.participantCount \?\? item\.bookedCount \?\? 0/,
  "overview course rows must display the current booking count"
);
assert.match(
  overviewSource,
  /<th>\$\{t\("bookings"\)\}<\/th>/,
  "overview course table must label the booking-count column"
);
assert.match(
  overviewSource,
  /<strong class="booking-count">\$\{item\.participantCount \?\? item\.bookedCount \?\? 0\}<\/strong>/,
  "overview course rows must emphasize the booking count"
);
assert.match(styles, /\.availability-table \{[^}]*table-layout: fixed;/);
assert.match(script, /<details class="panel settings-payment-disclosure">/);
assert.match(script, /<summary class="settings-payment-summary">/);
assert.match(script, /function paymentMethodsForDisplay\(methods\)/);
assert.match(script, /code: "apple_pay"/);
assert.match(script, /code: "google_pay"/);
assert.doesNotMatch(script, /code: "link"/);
assert.doesNotMatch(script, /code: "kr_card"/);
assert.match(script, /function paymentMethodIcon\(code\)/);
assert.match(script, /\/admin\/assets\/payment\//);
assert.match(script, /function cardNetworkLogos\(\)/);
for (const network of ["Visa", "Mastercard", "American Express", "Discover", "JCB", "Diners Club", "UnionPay"]) {
  assert.ok(script.includes(network), `missing admin card-network logo for ${network}`);
}
assert.match(script, /unionpay\.svg/);
assert.doesNotMatch(
  script,
  /data = \{ message: text \}/,
  "HTML upstream error pages must not be rendered as API error messages"
);
assert.match(script, /"invalid_response"/);

console.log("admin Web localization tests passed");
