import assert from "node:assert/strict";
import { createFirebaseAuthProvider } from "../apps/api/src/firebase-auth-provider.js";

const requests = [];
const responses = [
  ok({ localId: "firebase-user-1", email: "member@example.com", idToken: "signup-id", refreshToken: "signup-refresh", expiresIn: "3600" }),
  ok({ email: "member@example.com" }),
  ok({ localId: "firebase-user-1", email: "member@example.com", idToken: "login-id", refreshToken: "login-refresh", expiresIn: "3600" }),
  ok({ users: [{ localId: "firebase-user-1", email: "member@example.com", emailVerified: true }] }),
  ok({ user_id: "firebase-user-1", id_token: "refreshed-id", refresh_token: "refreshed-refresh", expires_in: "3600" }),
  ok({})
];

const provider = createFirebaseAuthProvider({
  apiKey: "firebase-browser-key",
  fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return responses.shift();
  }
});

assert.equal(provider.enabled, true);
const signup = await provider.signUp({ email: "member@example.com", password: "YogaPass123", locale: "zh-Hans" });
assert.equal(signup.uid, "firebase-user-1");
await provider.sendEmailVerification({ idToken: signup.idToken, locale: "zh-Hans" });
const login = await provider.signIn({ email: "member@example.com", password: "YogaPass123", locale: "en" });
assert.equal(login.emailVerified, true);
assert.equal(login.refreshToken, "login-refresh");
const refreshed = await provider.refreshSession({ refreshToken: login.refreshToken });
assert.equal(refreshed.idToken, "refreshed-id");
await provider.deleteCurrentUser({ idToken: refreshed.idToken });

assert.match(requests[0].url, /accounts:signUp\?key=firebase-browser-key$/);
assert.equal(requests[1].options.headers["X-Firebase-Locale"], "zh-CN");
assert.match(requests[2].url, /accounts:signInWithPassword/);
assert.match(requests[3].url, /accounts:lookup/);
assert.match(requests[4].url, /securetoken\.googleapis\.com\/v1\/token/);
assert.match(requests[4].options.body, /grant_type=refresh_token/);
assert.match(requests[5].url, /accounts:delete/);

const rejected = createFirebaseAuthProvider({
  apiKey: "firebase-browser-key",
  fetchImpl: async () => error(400, "INVALID_LOGIN_CREDENTIALS")
});
await assert.rejects(
  () => rejected.signIn({ email: "member@example.com", password: "wrong" }),
  (candidate) => candidate.status === 401 && candidate.code === "invalid_credentials"
);

const disabled = createFirebaseAuthProvider({ apiKey: "", fetchImpl: async () => ok({}) });
await assert.rejects(
  () => disabled.signUp({ email: "member@example.com", password: "YogaPass123" }),
  (candidate) => candidate.status === 503 && candidate.code === "firebase_auth_not_configured"
);

let timeoutSignal;
const timedOut = createFirebaseAuthProvider({
  apiKey: "firebase-browser-key",
  requestTimeoutMs: 25,
  fetchImpl: async (_url, options) => {
    timeoutSignal = options.signal;
    return new Promise(() => {});
  }
});
await assert.rejects(
  () => timedOut.signIn({ email: "member@example.com", password: "YogaPass123" }),
  (candidate) => candidate.status === 504 && candidate.code === "firebase_auth_timeout"
);
assert.equal(timeoutSignal.aborted, true);

console.log("firebase auth provider tests passed");

function ok(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function error(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
