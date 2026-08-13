import assert from "node:assert/strict";
import { createEmailProvider } from "../apps/api/src/email-provider.js";

let capturedRequest;
const provider = createEmailProvider({
  apiKey: "re_test_secret",
  from: "Good Vibe <accounts@goodvibe.test>",
  fetchImpl: async (url, options) => {
    capturedRequest = { url, options };
    return new Response(JSON.stringify({ id: "email_test_1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
});

assert.equal(provider.enabled, true);
assert.deepEqual(await provider.sendVerification({
  to: "member@example.com",
  code: "123456",
  locale: "en"
}), { id: "email_test_1" });
assert.equal(capturedRequest.url, "https://api.resend.com/emails");
assert.equal(capturedRequest.options.headers.Authorization, "Bearer re_test_secret");
const payload = JSON.parse(capturedRequest.options.body);
assert.deepEqual(payload.to, ["member@example.com"]);
assert.match(payload.text, /123456/);
assert.match(payload.html, /123456/);

const disabled = createEmailProvider({ apiKey: "", from: "", deliveryMode: "console", nodeEnv: "production" });
assert.equal(disabled.enabled, false);
await assert.rejects(
  disabled.sendVerification({ to: "member@example.com", code: "123456" }),
  (error) => error?.code === "email_service_not_configured"
);

const rejected = createEmailProvider({
  apiKey: "re_test_secret",
  from: "Good Vibe <accounts@goodvibe.test>",
  fetchImpl: async () => new Response(JSON.stringify({ message: "rejected" }), { status: 422 })
});
await assert.rejects(
  rejected.sendVerification({ to: "member@example.com", code: "123456" }),
  (error) => error?.code === "email_delivery_failed" && error?.details?.status === 422
);

console.log("Resend email provider tests passed");
