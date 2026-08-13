import assert from "node:assert/strict";
import fs from "node:fs";

const session = fs.readFileSync("src/state/session.tsx", "utf8");
const nativeStorage = fs.readFileSync("src/state/session-storage.ts", "utf8");
const webStorage = fs.readFileSync("src/state/session-storage.web.ts", "utf8");

assert.doesNotMatch(session, /expo-secure-store/);
assert.match(session, /getSessionValue\("token"\)/);
assert.match(session, /setSessionValue\("token", response\.token\)/);
assert.match(session, /deleteSessionValue\("token"\)/);
assert.match(session, /const \[locale, setLocaleState\] = useState<string>\(resolveInitialLocale\)/);
assert.match(session, /language\?\.startsWith\("zh"\)\) return "zh-Hans"/);

assert.match(nativeStorage, /expo-secure-store/);
assert.match(nativeStorage, /SecureStore\.getItemAsync/);
assert.match(nativeStorage, /SecureStore\.setItemAsync/);
assert.match(nativeStorage, /SecureStore\.deleteItemAsync/);

assert.doesNotMatch(webStorage, /expo-secure-store/);
assert.match(webStorage, /window\.localStorage/);
assert.match(webStorage, /\.getItem\(key\)/);
assert.match(webStorage, /\.setItem\(key, value\)/);
assert.match(webStorage, /\.removeItem\(key\)/);

console.log("platform session storage regression tests passed");
