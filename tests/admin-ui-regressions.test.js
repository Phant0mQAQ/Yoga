import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("apps/admin/index.html", "utf8");
const script = fs.readFileSync("apps/admin/app.js", "utf8");
const styles = fs.readFileSync("apps/admin/styles.css", "utf8");

assert.match(html, /<form class="login-form" id="loginForm">/);
assert.match(html, /id="loginBtn" type="submit"/);
assert.match(html, /id="loginHint"[^>]+role="status"[^>]+aria-live="polite"/);
assert.match(html, /id="appFrame"/);
assert.match(html, /role="dialog"[^>]+aria-modal="true"/);
assert.match(html, /id="modalError"[^>]+role="alert"[^>]+aria-live="assertive"/);
assert.match(html, /id="toast"[^>]+role="status"[^>]+aria-live="polite"/);

assert.match(script, /id="uploadFileInput" type="file" accept="image\/\*"/);
assert.match(script, /adminWrite\("\/admin\/uploads\/presign", "POST"/);
assert.match(script, /fetch\(result\.uploadUrl, \{ method: "PUT", headers, body: file \}\)/);
assert.match(script, /uploadState\.publicUrl = result\.publicUrl/);
assert.match(script, /id="uploadResult"[^>]+role="status"/);
assert.match(script, /result\.publicUrl/);
assert.doesNotMatch(script, /function openUploadForm/);
assert.match(styles, /\.upload-result/);

const refundHelpersStart = script.indexOf("function refundedAmountForPayment");
const refundHelpersEnd = script.indexOf("\n\nasync function handleViewClick", refundHelpersStart);
assert.notEqual(refundHelpersStart, -1, "refund amount helpers are missing");
assert.notEqual(refundHelpersEnd, -1, "refund helper boundary is missing");
const refundContext = {};
vm.runInNewContext(script.slice(refundHelpersStart, refundHelpersEnd), refundContext);

const refundablePayment = {
  id: "pay_1",
  status: "succeeded",
  refundStatus: "none",
  amount: 1000,
  stripePaymentIntentId: "pi_1"
};
assert.equal(refundContext.refundableAmountForPayment(refundablePayment), 1000);
assert.equal(refundContext.refundableAmountForPayment({ ...refundablePayment, refundedAmount: 250 }), 750);
assert.equal(refundContext.refundableAmountForPayment({ ...refundablePayment, refundableAmount: 300 }), 300);
assert.equal(refundContext.isRefundablePayment(refundablePayment), true);
assert.equal(refundContext.isRefundablePayment({ ...refundablePayment, status: "processing" }), false);
assert.equal(refundContext.isRefundablePayment({ ...refundablePayment, stripePaymentIntentId: null }), false);
assert.equal(refundContext.isRefundablePayment({ ...refundablePayment, refundStatus: "refunded" }), false);

assert.match(script, /field\("amount", "refundAmount", "number", true, \[\], \{ min: 1, max: maximum, step: 1 \}\)/);
assert.match(script, /Number\.isSafeInteger\(amount\) \|\| amount < 1 \|\| amount > maximum/);
assert.match(script, /refundsInFlight\.has\(id\)/);
assert.match(script, /refundsInFlight\.add\(id\)/);
assert.match(script, /\{ amount, reason: "web_admin" \}/);

assert.match(script, /priceAmount: 1/);
assert.doesNotMatch(script, /priceAmount: 0/);
assert.match(script, /if \(input\.value === ""\) return/);
assert.match(script, /\{ min: 1, step: 1 \}/);
assert.match(script, /const KNOWN_ROLES = \[/);
assert.match(script, /field\("roles", "roles", "multiselect", true/);
assert.match(script, /<select multiple/);

assert.match(script, /el\("appFrame"\)\.inert = true/);
assert.match(script, /el\("appFrame"\)\.inert = false/);
assert.match(script, /document\.addEventListener\("keydown", handleModalKeydown\)/);
assert.match(script, /event\.key === "Escape"/);
assert.match(script, /last\.focus\(\)/);
assert.match(script, /first\.focus\(\)/);
assert.match(script, /modalOpener = document\.activeElement/);
assert.match(script, /opener\.focus\(\)/);
assert.match(script, /refreshOpenModalTranslations\(\)/);
assert.match(script, /modalConfig\.initial = readForm/);

assert.match(script, /el\("loginForm"\)\.addEventListener\("submit"/);
assert.match(script, /if \(loginBusy \|\| !el\("loginForm"\)\.reportValidity\(\)\) return/);
assert.match(script, /setLoginBusy\(true\)/);
assert.match(script, /invalid_credentials: "invalidCredentials"/);
assert.match(script, /role_not_allowed: "roleNotAllowed"/);

assert.match(script, /let viewRequestVersion = 0/);
assert.match(script, /const requestId = \+\+viewRequestVersion/);
assert.match(script, /isCurrentViewRequest\(requestId, requestedView\)/);
assert.match(script, /aria-current/);
assert.match(script, /role="tablist"/);
assert.doesNotMatch(script, /demo-booking/);
assert.doesNotMatch(script, /createDemoBooking/);
assert.match(script, /aria-selected=/);

console.log("admin UI regression tests passed");
