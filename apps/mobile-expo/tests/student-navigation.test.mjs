import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studentLayout = readFileSync(
  new URL("../app/(student)/_layout.tsx", import.meta.url),
  "utf8"
);
const studentHome = readFileSync(
  new URL("../app/(student)/index.tsx", import.meta.url),
  "utf8"
);
const studentBookings = readFileSync(
  new URL("../app/(student)/bookings.tsx", import.meta.url),
  "utf8"
);

test("student navigation exposes Discover, Bookings, and Profile tabs", () => {
  assert.match(studentLayout, /name="index"/);
  assert.match(studentLayout, /name="bookings"/);
  assert.match(studentLayout, /title: t\("bookings"\)/);
  assert.match(studentLayout, /name="profile"/);
});

test("student home shows only the first three currently bookable sessions", () => {
  assert.match(
    studentHome,
    /const bookableClasses = availableClasses\.filter\(\(item\) => isSessionBookable\(item\)\)/
  );
  assert.match(studentHome, /bookableClasses\.slice\(0, 3\)\.map/);
  assert.doesNotMatch(studentHome, /t\("courseCatalog"\)/);
  assert.doesNotMatch(studentHome, /recommendedCourses/);
});

test("bookings tab keeps the complete bookable schedule and booking flow", () => {
  assert.match(studentBookings, /useStudentBooking\(\)/);
  assert.match(studentBookings, /isSessionBookable\(item\) \|\| pendingBookings\.has\(item\.id\)/);
  assert.match(studentBookings, /visibleClasses\.map/);
  assert.match(studentBookings, /onBook=\{\(\) => bookClass\(item\)\}/);
});
