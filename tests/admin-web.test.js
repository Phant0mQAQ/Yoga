import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("apps/admin/index.html", "utf8");
const script = fs.readFileSync("apps/admin/app.js", "utf8");
const config = fs.readFileSync("apps/admin/build.mjs", "utf8");

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

console.log("admin Web localization tests passed");
