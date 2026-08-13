import assert from "node:assert/strict";
import fs from "node:fs";

const models = fs.readFileSync("ios/GoodVibePilatesYogaApp/Models.swift", "utf8");
const app = fs.readFileSync("ios/GoodVibePilatesYogaApp/GoodVibePilatesYogaApp.swift", "utf8");
const apiClient = fs.readFileSync("ios/GoodVibePilatesYogaApp/APIClient.swift", "utf8");

assert.match(models, /let participantCount: Int\?/);
assert.match(models, /let imageUrl: String\?/);
assert.match(models, /var imageURL: URL\?/);
assert.match(models, /var reservationCount: Int \{\s+participantCount \?\? bookedCount\s+\}/);
assert.match(models, /var availableSpots: Int \{\s+max\(0, capacity - reservationCount\)\s+\}/);
assert.match(
  app,
  /"\\\(session\.reservationCount\) booked · \\\(session\.availableSpots\) spots left"/,
  "each native iOS course row must show its booking count and remaining spots"
);
assert.match(app, /\.disabled\(isBooking \|\| session\.availableSpots <= 0\)/);
assert.match(app, /AsyncImage\(url: imageURL\)/);
assert.match(apiClient, /GOOD_VIBE_API_BASE_URL/);
assert.match(apiClient, /good-vibe-pilates-yoga\.2316196563\.workers\.dev\/api\/v1\//);
assert.match(apiClient, /static let shared = APIClient\(baseURL: APIEnvironment\.baseURL\)/);
assert.match(apiClient, /path\.hasPrefix\("\/"\) \? String\(path\.dropFirst\(\)\) : path/);
assert.doesNotMatch(
  apiClient,
  /static let shared = APIClient\(baseURL: URL\(string: "http:\/\/localhost/,
  "Release builds must not be pinned to the developer machine"
);

console.log("iOS booking-count source tests passed");
