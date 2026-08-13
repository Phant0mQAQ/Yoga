import assert from "node:assert/strict";
import fs from "node:fs";

const authScreen = fs.readFileSync("app/(auth)/index.tsx", "utf8");
const apiClient = fs.readFileSync("src/api/client.ts", "utf8");
const session = fs.readFileSync("src/state/session.tsx", "utf8");
const sharedUi = fs.readFileSync("src/components/ui.tsx", "utf8");

assert.match(authScreen, /const roles: Role\[\] = \["student", "coach", "admin"\]/);
assert.match(authScreen, /action=\{session\.role \|\| pendingEmail \? null : <RoleSwitcher/);
assert.match(authScreen, /<Screen[\s\S]*<RoleSwitcher[\s\S]*contentInsetAdjustmentBehavior="automatic"/);
assert.match(authScreen, /process\.env\.EXPO_OS === "web"/);
assert.match(authScreen, /setWebMenuOpen\(\(open\) => !open\)/);
assert.match(authScreen, /styles\.webRoleMenu/);
assert.match(sharedUi, /header:[\s\S]*zIndex: 100/);
assert.match(sharedUi, /headerActions:[\s\S]*zIndex: 110/);
assert.match(authScreen, /role === "coach" \? coachInviteCode\.trim\(\) : undefined/);
assert.match(authScreen, /await session\.verifyEmail\(pendingEmail, password, role\)/);
assert.doesNotMatch(authScreen, /keyboardType="number-pad"|setVerificationCode|\[verificationCode,/);
assert.match(authScreen, /keyboardType="email-address"/);
assert.doesNotMatch(authScreen, /phone-pad|phonePlaceholder|IdentityKind/);
assert.match(authScreen, /nextRole === "admin" \? "signIn" : mode/);
assert.match(authScreen, /role === "admin" \? null : \(/);
assert.match(authScreen, /mode === "register" && role === "coach"/);
assert.match(authScreen, /placeholder=\{t\("coachInviteCode"\)\}/);
assert.match(authScreen, /t\("adminSignInOnly"\)/);
assert.doesNotMatch(authScreen, /"staff"/);

assert.match(apiClient, /request<RegistrationStartResponse>\("\/auth\/register"/);
assert.doesNotMatch(apiClient, /\/auth\/email\/verify/);
assert.match(apiClient, /\.\.\.\(inviteCode \? \{ inviteCode \} : \{\}\)/);
assert.match(apiClient, /new AbortController\(\)/);
assert.match(apiClient, /request_timeout/);
assert.match(apiClient, /timeoutMs: 20_000/);
assert.match(session, /setRole\(response\.session\.activeRole\)/);
assert.match(session, /inviteCode\?: string/);

console.log("iOS authentication UI regression tests passed");
