import assert from "node:assert/strict";
import fs from "node:fs";

const studentScreen = fs.readFileSync("app/(student)/index.tsx", "utf8");
const apiClient = fs.readFileSync("src/api/client.ts", "utf8");
const session = fs.readFileSync("src/state/session.tsx", "utf8");
const types = fs.readFileSync("src/api/types.ts", "utf8");

assert.match(studentScreen, /launchImageLibraryAsync\(\{[\s\S]*allowsEditing: true[\s\S]*aspect: \[1, 1\]/);
assert.match(studentScreen, /presignAvatarUpload\(\{ fileName, contentType, fileSize: asset\.fileSize \}\)/);
assert.match(studentScreen, /await saveAvatar\(upload\.objectKey\)/);
assert.match(studentScreen, /await session\.refreshUser\(\)/);
assert.match(studentScreen, /accessibilityLabel=\{t\("profilePhotoAccessibility"\)\}/);
assert.match(studentScreen, /person\.avatarUrl/);
assert.match(apiClient, /request<PresignedUpload>\("\/me\/avatar-upload"/);
assert.match(apiClient, /export async function uploadAvatarFile\(upload: PresignedUpload/);
assert.match(apiClient, /headers\.Authorization = `Bearer \$\{authToken\}`/);
assert.match(studentScreen, /await uploadAvatarFile\(upload, contentType, await localResponse\.blob\(\)\)/);
assert.match(apiClient, /request<User>\("\/me\/avatar"/);
assert.match(session, /refreshUser: \(\) => Promise<void>/);
assert.match(types, /avatarUrl\?: string \| null/);

console.log("avatar settings regression tests passed");
