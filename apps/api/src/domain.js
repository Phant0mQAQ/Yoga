import crypto from "node:crypto";

export const ROLES = Object.freeze({
  STUDENT: "student",
  COACH: "coach",
  STAFF: "staff",
  ADMIN: "admin"
});

export const FIXED_ADMIN_USER_ID = "usr_admin";

export const BOOKING_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  CHECKED_IN: "checked_in"
});

export const PAYMENT_STATUS = Object.freeze({
  REQUIRES_PAYMENT: "requires_payment",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  REFUNDED: "refunded"
});

export const CHECK_IN_EARLY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CHECK_IN_LATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"
]);

export const DEMO_PASSWORD = "GoodVibe@2026";

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derivedKey = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password, encodedHash) {
  const [algorithm, salt, expectedHex] = String(encodedHash ?? "").split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;

  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export const PAYMENT_METHODS = Object.freeze([
  {
    code: "card",
    family: "card",
    display: { en: "Cards", zh: "银行卡", ko: "카드" },
    currencies: ["*"],
    countries: ["*"],
    flow: "native_or_checkout",
    recurring: true
  },
  {
    code: "paypal",
    family: "wallet",
    display: { en: "PayPal", zh: "PayPal", ko: "PayPal" },
    currencies: ["AUD", "CAD", "CHF", "CZK", "DKK", "EUR", "GBP", "HKD", "NOK", "NZD", "PLN", "SEK", "SGD", "USD"],
    countries: ["*"],
    flow: "native_or_checkout",
    recurring: true
  },
  {
    code: "alipay",
    family: "local_wallet",
    display: { en: "Alipay", zh: "支付宝", ko: "Alipay" },
    currencies: ["AUD", "CAD", "CNY", "EUR", "GBP", "HKD", "JPY", "MYR", "NZD", "SGD", "USD"],
    countries: ["CN", "HK", "SG", "GB", "EU"],
    flow: "redirect",
    recurring: false
  },
  {
    code: "wechat_pay",
    family: "local_wallet",
    display: { en: "WeChat Pay", zh: "微信支付", ko: "WeChat Pay" },
    currencies: ["AUD", "CAD", "CHF", "CNY", "DKK", "EUR", "GBP", "HKD", "JPY", "NOK", "SEK", "SGD", "USD"],
    countries: ["CN", "HK", "SG", "GB", "EU"],
    flow: "checkout_redirect",
    recurring: false
  },
  {
    code: "kakao_pay",
    family: "local_wallet",
    display: { en: "Kakao Pay", zh: "Kakao Pay", ko: "카카오페이" },
    currencies: ["KRW"],
    countries: ["KR"],
    flow: "redirect",
    recurring: true
  },
  {
    code: "naver_pay",
    family: "local_wallet",
    display: { en: "Naver Pay", zh: "Naver Pay", ko: "네이버페이" },
    currencies: ["KRW"],
    countries: ["KR"],
    flow: "redirect",
    recurring: true
  },
  {
    code: "samsung_pay",
    family: "local_wallet",
    display: { en: "Samsung Pay", zh: "Samsung Pay", ko: "삼성페이" },
    currencies: ["KRW"],
    countries: ["KR"],
    flow: "redirect",
    recurring: false
  },
  {
    code: "payco",
    family: "local_wallet",
    display: { en: "PAYCO", zh: "PAYCO", ko: "PAYCO" },
    currencies: ["KRW"],
    countries: ["KR"],
    flow: "redirect",
    recurring: false
  }
]);

export function createSeedStore() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const demoPasswordHash = hashPassword(DEMO_PASSWORD);

  const store = {
    users: [
      {
        id: "usr_student",
        name: "Mia Chen",
        email: "student@example.com",
        phone: "+14155550101",
        locale: "en",
        roles: [ROLES.STUDENT],
        createdAt: now.toISOString()
      },
      {
        id: "usr_coach",
        name: "Sora Kim",
        email: "coach@example.com",
        phone: "+14155550102",
        locale: "ko",
        roles: [ROLES.COACH],
        createdAt: now.toISOString()
      },
      {
        id: "usr_staff",
        name: "Studio Staff",
        email: "staff@example.com",
        phone: "+14155550103",
        locale: "en",
        roles: [ROLES.STAFF],
        createdAt: now.toISOString()
      },
      {
        id: "usr_admin",
        name: "Admin",
        email: "admin@example.com",
        phone: "+14155550104",
        locale: "zh-Hans",
        roles: [ROLES.ADMIN],
        createdAt: now.toISOString()
      }
    ],
    authIdentities: [
      { id: "aid_student_email", userId: "usr_student", type: "email", value: "student@example.com", passwordHash: demoPasswordHash, verifiedAt: now.toISOString() },
      { id: "aid_coach_email", userId: "usr_coach", type: "email", value: "coach@example.com", passwordHash: demoPasswordHash, verifiedAt: now.toISOString() },
      { id: "aid_staff_email", userId: "usr_staff", type: "email", value: "staff@example.com", passwordHash: demoPasswordHash, verifiedAt: now.toISOString() },
      { id: "aid_admin_email", userId: "usr_admin", type: "email", value: "admin@example.com", passwordHash: demoPasswordHash, verifiedAt: now.toISOString() }
    ],
    emailVerificationChallenges: [],
    roleSessions: [],
    courseCategories: [
      { id: "cat_group", title: tr("Group Yoga", "团体瑜伽", "그룹 요가") },
      { id: "cat_private", title: tr("Private Class", "私教课程", "개인 레슨") }
    ],
    coaches: [
      {
        id: "coach_sora",
        userId: "usr_coach",
        name: "Sora Kim",
        age: 32,
        avatarUrl: "/assets/coaches/sora.jpg",
        yearsOfExperience: 9,
        tags: [tr("Pilates", "普拉提", "필라테스"), tr("Aerial Yoga", "空中瑜伽", "에어리얼 요가")],
        bio: tr("Calm strength and mobility coach.", "专注力量与灵活性的教练。", "근력과 유연성을 균형 있게 지도합니다.")
      }
    ],
    courses: [
      {
        id: "course_flow",
        categoryId: "cat_group",
        active: true,
        title: tr("Morning Flow", "晨间流瑜伽", "모닝 플로우"),
        description: tr("A balanced vinyasa class for all levels.", "适合各水平的流瑜伽课程。", "모든 레벨을 위한 빈야사 수업입니다."),
        durationMinutes: 60,
        priceAmount: 3800,
        currency: "USD",
        capacity: 8,
        memberCardDeductCount: 1,
        tags: ["vinyasa", "mobility"]
      },
      {
        id: "course_private",
        categoryId: "cat_private",
        active: true,
        title: tr("Private Alignment", "私教体态矫正", "개인 자세 교정"),
        description: tr("One-on-one class with posture assessment.", "一对一体态评估与练习。", "자세 평가가 포함된 1:1 레슨입니다."),
        durationMinutes: 75,
        priceAmount: 8800,
        currency: "USD",
        capacity: 1,
        memberCardDeductCount: 2,
        tags: ["private", "alignment"]
      }
    ],
    courseSessions: [
      {
        id: "sess_flow_1",
        courseId: "course_flow",
        coachId: "coach_sora",
        startsAt: tomorrow.toISOString(),
        endsAt: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
        capacity: 8,
        bookedCount: 0,
        status: "open"
      },
      {
        id: "sess_private_1",
        courseId: "course_private",
        coachId: "coach_sora",
        startsAt: nextWeek.toISOString(),
        endsAt: new Date(nextWeek.getTime() + 75 * 60 * 1000).toISOString(),
        capacity: 1,
        bookedCount: 0,
        status: "open"
      }
    ],
    coachAvailability: [
      {
        id: "av_sora_1",
        coachId: "coach_sora",
        startsAt: tomorrow.toISOString(),
        endsAt: new Date(tomorrow.getTime() + 8 * 60 * 60 * 1000).toISOString(),
        timezone: "America/Los_Angeles"
      }
    ],
    bookings: [],
    checkIns: [],
    membershipPlans: [
      {
        id: "plan_10",
        title: tr("10-Class Card", "10 次卡", "10회권"),
        totalCredits: 10,
        priceAmount: 32000,
        currency: "USD",
        validityDays: 180,
        autoRenew: false,
        contractVersion: "ca-2026-01",
        taxCategory: "fitness_service",
        benefits: [
          "priority_booking",
          "exclusive_courses",
          "store_discount"
        ]
      }
    ],
    memberCards: [
      {
        id: "card_student_10",
        userId: "usr_student",
        planId: "plan_10",
        status: "active",
        totalCredits: 10,
        remainingCredits: 10,
        expiresAt: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString(),
        frozenUntil: null,
        autoRenew: false,
        contractVersion: "ca-2026-01",
        contractAcceptedAt: now.toISOString()
      }
    ],
    cardTransactions: [],
    products: [
      {
        id: "prod_mat",
        title: tr("Studio Yoga Mat", "专业瑜伽垫", "스튜디오 요가 매트"),
        description: tr("Non-slip mat for studio practice.", "防滑专业练习垫。", "스튜디오 연습용 논슬립 매트입니다."),
        category: "yoga_mat",
        priceAmount: 4200,
        currency: "USD",
        stock: 20
      }
    ],
    orders: [],
    orderItems: [],
    payments: [],
    refunds: [],
    stripeEvents: [],
    reviews: [
      {
        id: "rev_1",
        userId: "usr_student",
        coachId: "coach_sora",
        courseId: "course_flow",
        rating: 5,
        comment: tr("Great pace and clear guidance.", "节奏很好，指导清晰。", "속도와 안내가 좋았습니다."),
        createdAt: now.toISOString()
      }
    ],
    bodyMetrics: [
      {
        id: "metric_1",
        userId: "usr_student",
        measuredAt: now.toISOString(),
        flexibilityScore: 72,
        balanceScore: 68,
        notes: "Initial mobility baseline."
      }
    ],
    contentBlocks: [
      {
        id: "banner_1",
        type: "banner",
        title: tr("Reset with mindful movement", "用瑜伽重启身心", "요가로 몸과 마음을 정돈하세요"),
        description: tr("Book your next class in one tap.", "一键预约下一节课程。", "다음 수업을 바로 예약하세요."),
        target: "booking",
        sortOrder: 1,
        active: true
      },
      {
        id: "feature_private",
        type: "feature",
        title: tr("Private Classes", "私教课程", "개인 레슨"),
        description: tr("Focused guidance for your body.", "根据身体状态定制指导。", "내 몸에 맞춘 집중 지도."),
        target: "private",
        sortOrder: 2,
        active: true
      },
      {
        id: "knowledge_breath",
        type: "knowledge",
        title: tr("Breathing Basics", "呼吸基础", "호흡의 기본"),
        description: tr("Use breath to stabilize each posture.", "用呼吸稳定每个体式。", "호흡으로 자세를 안정화합니다."),
        target: "article",
        sortOrder: 3,
        active: true
      }
    ],
    translations: [],
    privacyRequests: [],
    membershipCancellationRequests: [],
    auditLogs: [],
    idempotencyRecords: []
  };
  repairKnownTranslations(store);
  return store;
}

export function repairKnownTranslations(store) {
  let changed = false;
  for (const collectionName of ["privacyRequests", "membershipCancellationRequests"]) {
    if (!Array.isArray(store[collectionName])) {
      store[collectionName] = [];
      changed = true;
    }
  }
  const repair = (current, corrected) => {
    if (!current || typeof current !== "object") return current;
    const serialized = JSON.stringify(current);
    if (!/[鍥绉鐟娴鞖雼靷鏅\uFFFD]/.test(serialized)) {
      return current;
    }
    changed = true;
    return corrected;
  };

  const categoryGroup = byId(store.courseCategories, "cat_group");
  if (categoryGroup) categoryGroup.title = repair(categoryGroup.title, tr("Group Yoga", "团体瑜伽", "그룹 요가"));
  const categoryPrivate = byId(store.courseCategories, "cat_private");
  if (categoryPrivate) categoryPrivate.title = repair(categoryPrivate.title, tr("Private Class", "私教课程", "개인 레슨"));

  const coach = byId(store.coaches, "coach_sora");
  if (coach) {
    coach.tags = repair(coach.tags, [tr("Pilates", "普拉提", "필라테스"), tr("Aerial Yoga", "空中瑜伽", "에어리얼 요가")]);
    coach.bio = repair(coach.bio, tr("Calm strength and mobility coach.", "专注力量与灵活性的教练。", "차분한 근력과 가동성 코치입니다."));
  }

  const flowCourse = byId(store.courses, "course_flow");
  if (flowCourse) {
    flowCourse.title = repair(flowCourse.title, tr("Morning Flow", "晨间流瑜伽", "모닝 플로우 요가"));
    flowCourse.description = repair(
      flowCourse.description,
      tr("A balanced vinyasa class for all levels.", "适合各水平学员的均衡流瑜伽课程。", "모든 수준을 위한 균형 잡힌 빈야사 수업입니다.")
    );
  }
  const privateCourse = byId(store.courses, "course_private");
  if (privateCourse) {
    privateCourse.title = repair(privateCourse.title, tr("Private Alignment", "私教体态矫正", "개인 자세 교정"));
    privateCourse.description = repair(
      privateCourse.description,
      tr("One-on-one class with posture assessment.", "包含体态评估的一对一课程。", "자세 평가가 포함된 일대일 수업입니다.")
    );
  }

  const plan = byId(store.membershipPlans, "plan_10");
  if (plan) plan.title = repair(plan.title, tr("10-Class Card", "10 次卡", "10회권"));
  const product = byId(store.products, "prod_mat");
  if (product) {
    product.title = repair(product.title, tr("Studio Yoga Mat", "专业瑜伽垫", "스튜디오 요가 매트"));
    product.description = repair(
      product.description,
      tr("Non-slip mat for studio practice.", "适合教室练习的专业防滑垫。", "스튜디오 수련용 미끄럼 방지 매트입니다.")
    );
  }

  const review = byId(store.reviews, "rev_1");
  if (review) {
    review.comment = repair(
      review.comment,
      tr("Great pace and clear guidance.", "节奏很好，指导清晰。", "진행 속도가 좋고 안내가 명확합니다.")
    );
  }

  const banner = byId(store.contentBlocks, "banner_1");
  if (banner) {
    banner.title = repair(banner.title, tr("Reset with mindful movement", "用正念运动重启身心", "마음챙김 움직임으로 몸과 마음을 재정비하세요"));
    banner.description = repair(
      banner.description,
      tr("Book your next class in one tap.", "一键预约下一节课程。", "한 번의 탭으로 다음 수업을 예약하세요.")
    );
  }
  const privateFeature = byId(store.contentBlocks, "feature_private");
  if (privateFeature) {
    privateFeature.title = repair(privateFeature.title, tr("Private Classes", "私教课程", "개인 레슨"));
    privateFeature.description = repair(
      privateFeature.description,
      tr("Focused guidance for your body.", "根据身体状态提供专注指导。", "몸 상태에 맞춘 집중 지도를 제공합니다.")
    );
  }
  const breathing = byId(store.contentBlocks, "knowledge_breath");
  if (breathing) {
    breathing.title = repair(breathing.title, tr("Breathing Basics", "呼吸基础", "호흡 기초"));
    breathing.description = repair(
      breathing.description,
      tr("Use breath to stabilize each posture.", "用呼吸稳定每一个体式。", "호흡으로 각 자세를 안정시키세요.")
    );
  }
  return changed;
}

export function effectiveCourseSessionStatus(session, now = Date.now()) {
  if (session?.status !== "open") return session?.status;
  const startsAt = new Date(session.startsAt).getTime();
  return Number.isFinite(startsAt) && startsAt <= now ? "closed" : session.status;
}

export function repairOperationalState(store, now = Date.now()) {
  let changed = false;

  for (const collectionName of ["courses", "products", "contentBlocks"]) {
    for (const entity of store[collectionName] ?? []) {
      if (typeof entity.active !== "boolean") {
        entity.active = true;
        changed = true;
      }
    }
  }

  for (const session of store.courseSessions ?? []) {
    const status = effectiveCourseSessionStatus(session, now);
    if (status !== session.status) {
      session.status = status;
      session.updatedAt = new Date(now).toISOString();
      changed = true;
    }
  }

  return changed;
}

export function hardenProductionStore(store, {
  adminEmail = process.env.INITIAL_ADMIN_EMAIL,
  adminPassword = process.env.INITIAL_ADMIN_PASSWORD
} = {}) {
  if (process.env.NODE_ENV !== "production") return false;

  const normalizedAdminEmail = normalizeIdentity(adminEmail);
  const demoIdentities = store.authIdentities.filter(
    (identity) => verifyPassword(DEMO_PASSWORD, identity.passwordHash)
  );
  let changed = demoIdentities.length > 0;
  store.authIdentities = store.authIdentities.filter(
    (identity) => !verifyPassword(DEMO_PASSWORD, identity.passwordHash)
  );

  const adminUser = byId(store.users, "usr_admin");
  if (adminUser && adminUser.email !== normalizedAdminEmail) {
    adminUser.email = normalizedAdminEmail;
    changed = true;
  }

  const configuredIdentity = store.authIdentities.find(
    (identity) => identity.type === "email" && identity.value === normalizedAdminEmail
  );
  if (!configuredIdentity) {
    store.authIdentities.push({
      id: "aid_admin_email",
      userId: "usr_admin",
      type: "email",
      value: normalizedAdminEmail,
      passwordHash: hashPassword(adminPassword),
      verifiedAt: new Date().toISOString()
    });
    changed = true;
  }
  return changed;
}

export function enforceFixedAdminAccount(store) {
  const fixedAdmin = byId(store.users, FIXED_ADMIN_USER_ID);
  if (!fixedAdmin) return false;

  let changed = false;
  for (const user of store.users) {
    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (user.id === FIXED_ADMIN_USER_ID) {
      if (!roles.includes(ROLES.ADMIN)) {
        user.roles = [...roles, ROLES.ADMIN];
        changed = true;
      }
      continue;
    }
    if (roles.includes(ROLES.ADMIN)) {
      user.roles = roles.filter((role) => role !== ROLES.ADMIN);
      changed = true;
    }
  }

  const revokedAt = new Date().toISOString();
  for (const session of store.roleSessions) {
    if (
      session.activeRole === ROLES.ADMIN
      && session.userId !== FIXED_ADMIN_USER_ID
      && !session.revokedAt
    ) {
      session.revokedAt = revokedAt;
      changed = true;
    }
  }
  return changed;
}

const PAYMENT_METHOD_LABELS = Object.freeze({
  card: { en: "Cards", zh: "银行卡", "zh-Hans": "银行卡", ko: "카드" },
  paypal: { en: "PayPal", zh: "PayPal", "zh-Hans": "PayPal", ko: "PayPal" },
  alipay: { en: "Alipay", zh: "支付宝", "zh-Hans": "支付宝", ko: "Alipay" },
  wechat_pay: { en: "WeChat Pay", zh: "微信支付", "zh-Hans": "微信支付", ko: "WeChat Pay" },
  kakao_pay: { en: "Kakao Pay", zh: "Kakao Pay", "zh-Hans": "Kakao Pay", ko: "카카오페이" },
  naver_pay: { en: "Naver Pay", zh: "Naver Pay", "zh-Hans": "Naver Pay", ko: "네이버페이" },
  samsung_pay: { en: "Samsung Pay", zh: "Samsung Pay", "zh-Hans": "Samsung Pay", ko: "삼성페이" },
  payco: { en: "PAYCO", zh: "PAYCO", "zh-Hans": "PAYCO", ko: "PAYCO" }
});

export function tr(en, zh, ko) {
  return { en, "zh-Hans": zh, ko };
}

export function localize(value, locale = "en") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return value[locale] ?? value.en ?? value["zh-Hans"] ?? value.ko ?? "";
}

export function localizeEntity(entity, locale) {
  if (Array.isArray(entity)) return entity.map((item) => localizeEntity(item, locale));
  if (!entity || typeof entity !== "object") return entity;
  const out = {};
  for (const [key, value] of Object.entries(entity)) {
    if (key === "title" || key === "description" || key === "bio" || key === "comment") {
      out[key] = localize(value, locale);
    } else if (key === "tags" && Array.isArray(value)) {
      out[key] = value.map((tag) => localize(tag, locale));
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function login(store, { identifier, email, password, role, locale = "en" }, signToken) {
  const normalizedEmail = normalizeEmail(identifier ?? email);
  if (!normalizedEmail || !password || !Object.values(ROLES).includes(role)) {
    throw problem(400, "invalid_login_request", "Email, password, and a valid role are required");
  }

  const identity = store.authIdentities.find(
    (item) => item.type === "email" && item.value === normalizedEmail
  );
  if (!identity || !verifyPassword(password, identity.passwordHash)) {
    throw problem(401, "invalid_credentials", "Email or password is incorrect");
  }
  if (!identity.verifiedAt) {
    throw problem(403, "email_not_verified", "Verify your email before signing in");
  }

  const user = byId(store.users, identity.userId);
  if (!user) {
    throw problem(401, "invalid_credentials", "Email or password is incorrect");
  }
  if (!user.roles.includes(role)) {
    throw problem(403, "role_not_allowed", `User cannot log in as ${role}`);
  }

  return createRoleSession(store, user, role, locale, signToken);
}

export function prepareFirebaseRegistration(store, {
  name,
  email: emailInput,
  identifier,
  password,
  role = ROLES.STUDENT,
  locale = "en",
  inviteCode
}, {
  coachInviteCode = configuredCoachInviteCode()
} = {}) {
  validatePublicRegistrationRole(role, inviteCode, coachInviteCode);
  const displayName = String(name ?? "").trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 80) {
    throw problem(400, "invalid_name", "Name must be between 2 and 80 characters");
  }
  const email = normalizeEmail(emailInput ?? identifier);
  if (!email) throw problem(400, "invalid_email", "Enter a valid email address");
  if (!isStrongPassword(password)) {
    throw problem(400, "weak_password", "Password must contain at least 8 characters, one letter, and one number");
  }
  if (store.authIdentities.some((item) => item.type === "email" && item.value === email)) {
    throw problem(409, "email_already_in_use", "This email is already registered");
  }
  return { name: displayName, email, password, role, locale };
}

export function registerFirebaseUser(store, registration, firebaseUid) {
  const uid = String(firebaseUid ?? "").trim();
  if (!uid) throw problem(502, "firebase_auth_invalid_response", "Firebase user ID is missing");
  if (store.authIdentities.some((item) => item.firebaseUid === uid)) {
    throw problem(409, "email_already_in_use", "This Firebase account is already linked");
  }
  if (store.authIdentities.some((item) => item.type === "email" && item.value === registration.email)) {
    throw problem(409, "email_already_in_use", "This email is already registered");
  }

  const now = new Date().toISOString();
  const user = {
    id: id("usr"),
    name: registration.name,
    email: registration.email,
    locale: registration.locale,
    roles: [registration.role],
    createdAt: now
  };
  store.users.push(user);
  if (registration.role === ROLES.COACH) addCoachProfile(store, user);
  store.authIdentities.push({
    id: id("aid"),
    userId: user.id,
    type: "email",
    value: registration.email,
    provider: "firebase",
    firebaseUid: uid,
    verifiedAt: null,
    createdAt: now
  });
  audit(store, { userId: user.id, activeRole: registration.role }, "auth.registration", user.id, {
    identityType: "email",
    provider: "firebase"
  });
  return {
    requiresVerification: true,
    email: registration.email,
    verificationMethod: "link"
  };
}

export function loginWithFirebaseUser(store, firebaseAccount, { role, locale = "en" }, signToken) {
  const uid = String(firebaseAccount?.uid ?? "").trim();
  const email = normalizeEmail(firebaseAccount?.email);
  if (!uid || !email || !Object.values(ROLES).includes(role)) {
    throw problem(400, "invalid_login_request", "Email, password, and a valid role are required");
  }
  if (!firebaseAccount.emailVerified) {
    throw problem(403, "email_not_verified", "Verify your email before signing in");
  }
  if (firebaseAccount.disabled) throw problem(403, "account_disabled", "This account has been disabled");

  const identity = store.authIdentities.find((item) => item.firebaseUid === uid)
    ?? store.authIdentities.find((item) => item.type === "email" && item.value === email);
  if (!identity || (identity.firebaseUid && identity.firebaseUid !== uid)) {
    throw problem(401, "account_not_linked", "This Firebase account is not linked to a Good Vibe account");
  }

  const user = byId(store.users, identity.userId);
  if (!user || user.deletedAt) throw problem(401, "account_not_linked", "This account is not active");
  if (!user.roles.includes(role)) {
    throw problem(403, "role_not_allowed", `User cannot log in as ${role}`);
  }

  const now = new Date().toISOString();
  identity.provider = "firebase";
  identity.firebaseUid = uid;
  identity.verifiedAt = identity.verifiedAt ?? now;
  delete identity.passwordHash;
  user.email = email;
  audit(store, { userId: user.id, activeRole: role }, "auth.firebase_login", user.id, { firebaseUid: uid });
  return createRoleSession(store, user, role, locale, signToken);
}

export function register(store, {
  name,
  email: emailInput,
  identifier,
  password,
  role = ROLES.STUDENT,
  locale = "en",
  inviteCode
}, signToken, {
  coachInviteCode = configuredCoachInviteCode()
} = {}) {
  validatePublicRegistrationRole(role, inviteCode, coachInviteCode);
  const displayName = String(name ?? "").trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 80) {
    throw problem(400, "invalid_name", "Name must be between 2 and 80 characters");
  }
  const normalizedEmail = normalizeEmail(emailInput ?? identifier);
  if (!normalizedEmail) {
    throw problem(400, "invalid_email", "Enter a valid email address");
  }
  if (!isStrongPassword(password)) {
    throw problem(400, "weak_password", "Password must contain at least 8 characters, one letter, and one number");
  }
  if (store.authIdentities.some((item) => (
    item.type === "email" && item.value === normalizedEmail
  ))) {
    throw problem(409, "email_already_in_use", "This email is already registered");
  }

  const now = new Date().toISOString();
  const user = {
    id: id("usr"),
    name: displayName,
    email: normalizedEmail,
    locale,
    roles: [role],
    createdAt: now
  };
  store.users.push(user);
  if (role === ROLES.COACH) addCoachProfile(store, user);
  store.authIdentities.push({
    id: id("aid"),
    userId: user.id,
    type: "email",
    value: normalizedEmail,
    passwordHash: hashPassword(password),
    verifiedAt: null,
    createdAt: now
  });
  const { challenge, code: verificationCode } = createEmailVerificationChallenge(store, user.id, normalizedEmail);
  audit(store, { userId: user.id, activeRole: role }, "auth.registration", user.id, {
    identityType: "email"
  });
  return {
    response: { requiresVerification: true, email: normalizedEmail, expiresAt: challenge.expiresAt },
    delivery: { email: normalizedEmail, code: verificationCode, expiresAt: challenge.expiresAt },
    userId: user.id
  };
}

export function resendEmailVerification(store, { email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const identity = store.authIdentities.find((item) => item.type === "email" && item.value === normalizedEmail);
  if (!identity || !verifyPassword(password, identity.passwordHash)) {
    throw problem(401, "invalid_credentials", "Email or password is incorrect");
  }
  if (identity.verifiedAt) throw problem(409, "email_already_verified", "Email is already verified");
  const latest = [...store.emailVerificationChallenges].reverse().find((item) => item.userId === identity.userId);
  if (latest && Date.now() - new Date(latest.createdAt).getTime() < 60_000) {
    throw problem(429, "verification_code_cooldown", "Wait before requesting another verification code");
  }
  const now = new Date().toISOString();
  for (const challenge of store.emailVerificationChallenges) {
    if (challenge.userId === identity.userId && !challenge.consumedAt) challenge.consumedAt = now;
  }
  const { challenge, code } = createEmailVerificationChallenge(store, identity.userId, normalizedEmail);
  return {
    response: { requiresVerification: true, email: normalizedEmail, expiresAt: challenge.expiresAt },
    delivery: { email: normalizedEmail, code, expiresAt: challenge.expiresAt },
    userId: identity.userId
  };
}

export function verifyEmailRegistration(store, { email, code, locale = "en" }, signToken) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(code ?? "").trim();
  if (!normalizedEmail || !/^\d{6}$/.test(normalizedCode)) {
    throw problem(400, "invalid_verification_code", "Enter the six-digit verification code");
  }
  const identity = store.authIdentities.find((item) => item.type === "email" && item.value === normalizedEmail);
  if (!identity) throw problem(404, "registration_not_found", "Registration was not found");
  if (identity.verifiedAt) throw problem(409, "email_already_verified", "Email is already verified");
  const challenge = [...store.emailVerificationChallenges]
    .reverse()
    .find((item) => item.userId === identity.userId && !item.consumedAt);
  if (!challenge || new Date(challenge.expiresAt).getTime() <= Date.now()) {
    throw problem(410, "verification_code_expired", "Verification code has expired");
  }
  if (challenge.attempts >= 5) {
    throw problem(429, "verification_attempts_exceeded", "Too many verification attempts");
  }
  challenge.attempts += 1;
  if (!verificationCodeMatches(normalizedCode, challenge.codeHash, challenge.codeSalt)) {
    throw problem(400, "invalid_verification_code", "Verification code is incorrect");
  }
  const now = new Date().toISOString();
  identity.verifiedAt = now;
  challenge.consumedAt = now;
  const user = byIdRequired(store.users, identity.userId, "user_not_found");
  const verifiedRole = user.roles.includes(ROLES.COACH) ? ROLES.COACH : ROLES.STUDENT;
  audit(store, { userId: user.id, activeRole: verifiedRole }, "auth.email_verified", user.id, {});
  return createRoleSession(store, user, verifiedRole, locale, signToken);
}

export function discardPendingRegistration(store, userId) {
  const identity = store.authIdentities.find((item) => item.userId === userId);
  if (identity?.verifiedAt) return false;
  store.users = store.users.filter((item) => item.id !== userId);
  store.authIdentities = store.authIdentities.filter((item) => item.userId !== userId);
  store.emailVerificationChallenges = store.emailVerificationChallenges.filter((item) => item.userId !== userId);
  store.coaches = store.coaches.filter((item) => item.userId !== userId);
  store.auditLogs = store.auditLogs.filter((item) => item.actorUserId !== userId && item.entityId !== userId);
  return true;
}

function validatePublicRegistrationRole(role, inviteCode, coachInviteCode) {
  if (role === ROLES.ADMIN || ![ROLES.STUDENT, ROLES.COACH].includes(role)) {
    throw problem(403, "role_registration_restricted", "Administrator accounts cannot be registered");
  }
  if (role !== ROLES.COACH) return;
  const expected = String(coachInviteCode ?? "").trim();
  if (!expected) {
    throw problem(503, "coach_registration_not_configured", "Coach registration is not configured");
  }
  if (!secureTextEqual(String(inviteCode ?? "").trim(), expected)) {
    throw problem(403, "invalid_coach_invite_code", "The coach invitation code is invalid");
  }
}

function configuredCoachInviteCode() {
  return globalThis.__GOOD_VIBE_COACH_INVITE_CODE__ ?? process.env.COACH_INVITE_CODE;
}

function secureTextEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function addCoachProfile(store, user) {
  store.coaches.push({
    id: id("coach"),
    userId: user.id,
    name: user.name,
    age: null,
    avatarUrl: null,
    yearsOfExperience: 0,
    tags: [],
    bio: tr("", "", "")
  });
}

function createRoleSession(store, user, role, locale, signToken) {

  const session = {
    id: id("ses"),
    userId: user.id,
    activeRole: role,
    locale,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: null
  };
  store.roleSessions.push(session);
  const token = signToken({
    sid: session.id,
    sub: user.id,
    active_role: role,
    exp: Math.floor(new Date(session.expiresAt).getTime() / 1000)
  });
  return { token, session, user: publicUser(user) };
}

export function logout(store, sessionId) {
  const session = byId(store.roleSessions, sessionId);
  if (session && !session.revokedAt) session.revokedAt = new Date().toISOString();
  return { ok: true };
}

export function getCurrentUser(store, auth) {
  const user = byId(store.users, auth.userId);
  return {
    user: publicUser(user),
    activeRole: auth.activeRole,
    sessionId: auth.sessionId
  };
}

export function getPaymentMethods({ currency = "USD", country = "US", recurring = false, all = false } = {}) {
  const normalizedCurrency = currency.toUpperCase();
  const normalizedCountry = country.toUpperCase();
  return PAYMENT_METHODS.filter((method) => {
    if (all) return !recurring || method.recurring;
    const currencyOk = method.currencies.includes("*") || method.currencies.includes(normalizedCurrency);
    const countryOk = isCountryEligible(method, normalizedCountry);
    const recurringOk = !recurring || method.recurring;
    return currencyOk && countryOk && recurringOk;
  }).map((method) => ({
    ...method,
    display: PAYMENT_METHOD_LABELS[method.code] ?? method.display,
    cardDisplayGroup: method.code === "card" ? "cards" : undefined
  }));
}

export function createBooking(store, auth, body = {}, idempotencyKey) {
  requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
  const userId = auth.activeRole === ROLES.STUDENT ? auth.userId : body.userId;
  const scope = `createBooking:${auth.userId}:${auth.activeRole}:${userId ?? "missing"}`;
  return withIdempotency(store, idempotencyKey, scope, () => {
    if (!userId) throw problem(400, "missing_user_id", "userId is required for staff/admin booking");
    byIdRequired(store.users, userId, "user_not_found");
    const courseSession = byIdRequired(store.courseSessions, body.courseSessionId, "course_session_not_found");
    const course = byIdRequired(store.courses, courseSession.courseId, "course_not_found");
    if (course.active === false) {
      throw problem(409, "course_inactive", "Course is not available for booking");
    }
    if (courseSession.status !== "open") {
      throw problem(409, "session_closed", "Course session is not open");
    }
    requireFutureSession(courseSession);
    const capacity = requirePositiveInteger(courseSession.capacity, "invalid_session_capacity", "capacity");
    const bookedCount = requireNonNegativeInteger(courseSession.bookedCount ?? 0, "invalid_booked_count", "bookedCount");
    if (store.bookings.some((booking) => (
      booking.userId === userId
      && booking.courseSessionId === courseSession.id
      && booking.status !== BOOKING_STATUS.CANCELLED
    ))) {
      throw problem(409, "duplicate_booking", "User already has an active booking for this course session");
    }
    if (bookedCount >= capacity) {
      throw problem(409, "session_full", "Course session is full");
    }

    const shouldUseCard = body.paymentMode === "member_card";
    const creditCost = shouldUseCard
      ? requirePositiveInteger(course.memberCardDeductCount, "invalid_course_credit_cost", "memberCardDeductCount")
      : 0;
    const activeCards = store.memberCards
      .filter((card) => card.userId === userId)
      .map((card) => normalizeMemberCardStatus(card))
      .filter((card) => card.status === "active" && new Date(card.expiresAt).getTime() > Date.now())
      .sort((left, right) => (
        new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime()
        || left.id.localeCompare(right.id)
      ));
    const activeCard = shouldUseCard
      ? activeCards.find((card) => Number.isSafeInteger(card.remainingCredits) && card.remainingCredits >= creditCost)
      : null;
    let status = BOOKING_STATUS.PENDING_PAYMENT;
    let order = null;

    if (shouldUseCard) {
      if (!activeCards.length) throw problem(409, "no_active_card", "User has no active, unexpired member card");
      if (!activeCard) throw problem(409, "insufficient_credits", "Member card does not have enough credits");
      const remainingCredits = requireNonNegativeInteger(activeCard.remainingCredits, "invalid_card_credits", "remainingCredits");
      if (remainingCredits < creditCost) {
        throw problem(409, "insufficient_credits", "Member card does not have enough credits");
      }
      activeCard.remainingCredits = remainingCredits - creditCost;
      store.cardTransactions.push({
        id: id("ctx"),
        cardId: activeCard.id,
        userId,
        type: "deduct",
        credits: -creditCost,
        reason: "booking",
        createdAt: new Date().toISOString()
      });
      status = BOOKING_STATUS.CONFIRMED;
    } else {
      const priceAmount = requirePositiveInteger(course.priceAmount, "invalid_course_price", "priceAmount");
      order = createOrderInternal(store, userId, [{
        type: "course_session",
        refId: courseSession.id,
        title: course.title,
        quantity: 1,
        unitAmount: priceAmount,
        currency: course.currency
      }]);
    }

    courseSession.bookedCount = bookedCount + 1;
    const booking = {
      id: id("bkg"),
      userId,
      courseId: course.id,
      courseSessionId: courseSession.id,
      coachId: courseSession.coachId,
      orderId: order?.id ?? null,
      memberCardId: shouldUseCard ? activeCard.id : null,
      memberCardCreditsUsed: shouldUseCard ? creditCost : 0,
      status,
      startsAt: courseSession.startsAt,
      endsAt: courseSession.endsAt,
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      checkedInAt: null
    };
    store.bookings.push(booking);
    audit(store, auth, "booking.create", booking.id, { status });
    return { booking, order };
  });
}

export function cancelBooking(store, auth, bookingId, reason = "user_request") {
  const booking = byIdRequired(store.bookings, bookingId, "booking_not_found");
  requireOwnershipOrRole(auth, booking.userId, [ROLES.STAFF, ROLES.ADMIN]);
  if (booking.status === BOOKING_STATUS.CHECKED_IN) {
    throw problem(409, "already_checked_in", "Checked-in bookings cannot be cancelled normally");
  }
  if (booking.status === BOOKING_STATUS.CANCELLED) return { booking };

  let cardRefund = null;
  if (booking.memberCardId) {
    const card = byIdRequired(store.memberCards, booking.memberCardId, "member_card_not_found");
    const course = byId(store.courses, booking.courseId);
    const refundCredits = requirePositiveInteger(
      booking.memberCardCreditsUsed ?? course?.memberCardDeductCount,
      "invalid_booking_credit_cost",
      "memberCardCreditsUsed"
    );
    const remainingCredits = requireNonNegativeInteger(card.remainingCredits, "invalid_card_credits", "remainingCredits");
    const totalCredits = requirePositiveInteger(card.totalCredits, "invalid_card_credits", "totalCredits");
    if (!Number.isSafeInteger(remainingCredits + refundCredits) || remainingCredits + refundCredits > totalCredits) {
      throw problem(409, "card_credit_invariant", "Cancellation would exceed the member card credit total");
    }
    cardRefund = { card, refundCredits, nextRemainingCredits: remainingCredits + refundCredits };
  }

  const previousStatus = booking.status;
  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelledAt = new Date().toISOString();
  booking.cancelReason = reason;
  const session = byId(store.courseSessions, booking.courseSessionId);
  if (session) session.bookedCount = Math.max(0, session.bookedCount - 1);

  if (cardRefund) {
    cardRefund.card.remainingCredits = cardRefund.nextRemainingCredits;
    store.cardTransactions.push({
      id: id("ctx"),
      cardId: cardRefund.card.id,
      userId: cardRefund.card.userId,
      type: "refund",
      credits: cardRefund.refundCredits,
      reason: "booking_cancelled",
      createdAt: new Date().toISOString()
    });
  }
  if (previousStatus === BOOKING_STATUS.PENDING_PAYMENT && booking.orderId) {
    const order = byId(store.orders, booking.orderId);
    if (order && order.status === "pending_payment") {
      order.status = "cancelled";
      order.cancelledAt = booking.cancelledAt;
      order.resourcesReleasedAt = booking.cancelledAt;
    }
    for (const payment of store.payments.filter((candidate) => candidate.orderId === booking.orderId)) {
      if ([PAYMENT_STATUS.REQUIRES_PAYMENT, PAYMENT_STATUS.PROCESSING].includes(payment.status)) {
        payment.status = PAYMENT_STATUS.FAILED;
        payment.failureReason = "booking_cancelled";
      }
    }
  }
  audit(store, auth, "booking.cancel", booking.id, { reason });
  return { booking };
}

export function rescheduleBooking(store, auth, bookingId, nextSessionId) {
  const booking = byIdRequired(store.bookings, bookingId, "booking_not_found");
  requireOwnershipOrRole(auth, booking.userId, [ROLES.STAFF, ROLES.ADMIN]);
  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw problem(409, "not_reschedulable", "Only confirmed bookings can be rescheduled");
  }
  const nextSession = byIdRequired(store.courseSessions, nextSessionId, "course_session_not_found");
  if (nextSession.id === booking.courseSessionId) return { booking };
  requireFutureSession(nextSession);

  const previousSession = byIdRequired(store.courseSessions, booking.courseSessionId, "course_session_not_found");
  const previousCourse = byIdRequired(store.courses, booking.courseId, "course_not_found");
  const nextCourse = byIdRequired(store.courses, nextSession.courseId, "course_not_found");
  const previousBookedCount = requireNonNegativeInteger(previousSession.bookedCount ?? 0, "invalid_booked_count", "bookedCount");
  const nextBookedCount = requireNonNegativeInteger(nextSession.bookedCount ?? 0, "invalid_booked_count", "bookedCount");
  const nextCapacity = requirePositiveInteger(nextSession.capacity, "invalid_session_capacity", "capacity");
  if (nextSession.status !== "open" || nextBookedCount >= nextCapacity) {
    throw problem(409, "next_session_unavailable", "Next session is unavailable");
  }
  if (store.bookings.some((candidate) => (
    candidate.id !== booking.id
    && candidate.userId === booking.userId
    && candidate.courseSessionId === nextSession.id
    && candidate.status !== BOOKING_STATUS.CANCELLED
  ))) {
    throw problem(409, "duplicate_booking", "User already has an active booking for the target course session");
  }

  let card = null;
  let remainingCredits = null;
  let creditDelta = 0;
  if (booking.memberCardId) {
    card = byIdRequired(store.memberCards, booking.memberCardId, "member_card_not_found");
    const previousCost = requirePositiveInteger(
      booking.memberCardCreditsUsed ?? previousCourse.memberCardDeductCount,
      "invalid_booking_credit_cost",
      "memberCardCreditsUsed"
    );
    const nextCost = requirePositiveInteger(nextCourse.memberCardDeductCount, "invalid_course_credit_cost", "memberCardDeductCount");
    remainingCredits = requireNonNegativeInteger(card.remainingCredits, "invalid_card_credits", "remainingCredits");
    const totalCredits = requirePositiveInteger(card.totalCredits, "invalid_card_credits", "totalCredits");
    creditDelta = nextCost - previousCost;
    if (creditDelta > remainingCredits) {
      throw problem(409, "insufficient_credits", "Member card does not have enough credits for the target course");
    }
    if (remainingCredits - creditDelta > totalCredits) {
      throw problem(409, "card_credit_invariant", "Reschedule would exceed the member card credit total");
    }
  } else if (booking.orderId && (
    previousCourse.currency !== nextCourse.currency
    || previousCourse.priceAmount !== nextCourse.priceAmount
  )) {
    throw problem(409, "reschedule_payment_adjustment_required", "Paid bookings can only move to a course with the same price and currency");
  }

  previousSession.bookedCount = Math.max(0, previousBookedCount - 1);
  nextSession.bookedCount = nextBookedCount + 1;
  if (card && creditDelta !== 0) {
    card.remainingCredits = remainingCredits - creditDelta;
    store.cardTransactions.push({
      id: id("ctx"),
      cardId: card.id,
      userId: booking.userId,
      type: creditDelta > 0 ? "deduct" : "refund",
      credits: -creditDelta,
      reason: "booking_rescheduled",
      createdAt: new Date().toISOString()
    });
  }
  booking.courseSessionId = nextSession.id;
  booking.courseId = nextSession.courseId;
  booking.coachId = nextSession.coachId;
  booking.startsAt = nextSession.startsAt;
  booking.endsAt = nextSession.endsAt;
  if (card) booking.memberCardCreditsUsed = requirePositiveInteger(nextCourse.memberCardDeductCount, "invalid_course_credit_cost", "memberCardDeductCount");
  booking.updatedAt = new Date().toISOString();
  audit(store, auth, "booking.reschedule", booking.id, { nextSessionId, creditDelta });
  return { booking };
}

export function checkInBooking(store, auth, bookingId, method = "manual") {
  requireRole(auth, [ROLES.COACH, ROLES.STAFF, ROLES.ADMIN]);
  const booking = byIdRequired(store.bookings, bookingId, "booking_not_found");
  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw problem(409, "not_checkin_eligible", "Only a confirmed booking can be checked in");
  }
  const startsAt = new Date(booking.startsAt).getTime();
  const endsAt = new Date(booking.endsAt).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    throw problem(409, "invalid_checkin_window", "Booking has an invalid check-in time window");
  }
  const now = Date.now();
  if (now < startsAt - CHECK_IN_EARLY_WINDOW_MS) {
    throw problem(409, "checkin_too_early", "Check-in opens 24 hours before the course starts");
  }
  if (now > endsAt + CHECK_IN_LATE_WINDOW_MS) {
    throw problem(409, "checkin_window_closed", "Check-in closes 24 hours after the course ends");
  }
  if (auth.activeRole === ROLES.COACH) {
    const coach = store.coaches.find((candidate) => candidate.userId === auth.userId);
    if (!coach || booking.coachId !== coach.id) {
      throw problem(403, "coach_booking_forbidden", "Coaches can only check in bookings for their own sessions");
    }
  }
  booking.status = BOOKING_STATUS.CHECKED_IN;
  booking.checkedInAt = new Date().toISOString();
  const checkIn = {
    id: id("chk"),
    bookingId,
    userId: booking.userId,
    method,
    checkedInBy: auth.userId,
    createdAt: booking.checkedInAt
  };
  store.checkIns.push(checkIn);
  audit(store, auth, "booking.check_in", booking.id, { method });
  return { booking, checkIn };
}

export function createOrder(store, auth, body = {}, idempotencyKey) {
  requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
  const userId = auth.activeRole === ROLES.STUDENT ? auth.userId : body.userId;
  const scope = `createOrder:${auth.userId}:${auth.activeRole}:${userId ?? "missing"}`;
  return withIdempotency(store, idempotencyKey, scope, () => {
    if (!userId) throw problem(400, "missing_user_id", "userId is required for staff/admin orders");
    byIdRequired(store.users, userId, "user_not_found");
    if (!Array.isArray(body.items)) throw problem(400, "invalid_order_items", "items must be an array");
    const pendingItems = body.items.map((item) => {
      const product = byIdRequired(store.products, item.productId, "product_not_found");
      if (product.active === false) {
        throw problem(409, "product_inactive", "Product is not available for purchase");
      }
      const quantity = requirePositiveInteger(item.quantity, "invalid_quantity", "quantity");
      const stock = requireNonNegativeInteger(product.stock, "invalid_product_stock", "stock");
      const unitAmount = requirePositiveInteger(product.priceAmount, "invalid_product_price", "priceAmount");
      if (stock < quantity) throw problem(409, "insufficient_stock", "Product stock is insufficient");
      return {
        product,
        stock,
        type: "product",
        refId: product.id,
        title: product.title,
        quantity,
        unitAmount,
        currency: product.currency
      };
    });
    validateOrderItems(pendingItems);
    for (const item of pendingItems) item.product.stock = item.stock - item.quantity;
    const items = pendingItems.map(({ product, stock, ...item }) => item);
    const order = createOrderInternal(store, userId, items);
    audit(store, auth, "order.create", order.id, {});
    return { order };
  });
}

export function validatePaymentRequest(store, auth, {
  orderId,
  amount,
  currency,
  country,
  methodCode = "card"
} = {}) {
  requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
  const order = orderId ? byIdRequired(store.orders, orderId, "order_not_found") : null;
  if (order && auth.activeRole === ROLES.STUDENT && order.userId !== auth.userId) {
    throw problem(403, "forbidden", "Cannot pay another user's order");
  }
  if (order && order.status !== "pending_payment") {
    throw problem(409, "order_not_payable", "Order is not awaiting payment");
  }
  const method = PAYMENT_METHODS.find((item) => item.code === methodCode);
  if (!method) throw problem(400, "unsupported_payment_method", "Unsupported payment method");
  const normalizedCurrency = String(currency ?? order?.currency ?? "USD").trim().toUpperCase();
  const normalizedCountry = String(country ?? "US").trim().toUpperCase();
  const normalizedAmount = requirePositiveInteger(amount ?? order?.totalAmount, "invalid_payment_amount", "amount");
  if (order && normalizedAmount !== order.totalAmount) {
    throw problem(409, "payment_amount_mismatch", "Payment amount must equal the order total");
  }
  if (order && normalizedCurrency !== String(order.currency).toUpperCase()) {
    throw problem(409, "payment_currency_mismatch", "Payment currency must equal the order currency");
  }
  if (!isMethodEligible(method, normalizedCurrency, normalizedCountry)) {
    throw problem(400, "payment_method_not_eligible", `${methodCode} is not eligible for ${normalizedCurrency}/${normalizedCountry}`);
  }
  return {
    order,
    orderId: order?.id ?? null,
    amount: normalizedAmount,
    currency: normalizedCurrency,
    country: normalizedCountry,
    methodCode,
    method
  };
}

export function createPaymentRecord(store, auth, request = {}) {
  const { providerPayload } = request;
  const resolved = validatePaymentRequest(store, auth, request);
  const { order, amount, currency, country, methodCode, method } = resolved;
  const existingPayment = order && store.payments.find((payment) => (
    payment.orderId === order.id && payment.status !== PAYMENT_STATUS.FAILED
  ));
  if (existingPayment) {
    throw problem(409, "order_payment_in_progress", "This order already has an active payment attempt");
  }
  const payment = {
    id: id("pay"),
    orderId: order?.id ?? null,
    userId: order?.userId ?? auth.userId,
    paymentProvider: "stripe",
    paymentMethodFamily: method.family,
    paymentMethodCode: method.code,
    amount,
    currency,
    country,
    status: PAYMENT_STATUS.REQUIRES_PAYMENT,
    refundStatus: "none",
    stripePaymentIntentId: providerPayload?.paymentIntentId ?? null,
    stripeCheckoutSessionId: providerPayload?.checkoutSessionId ?? null,
    stripeCheckoutUrl: providerPayload?.checkoutUrl ?? null,
    stripeCheckoutExpiresAt: providerPayload?.checkoutExpiresAt ?? null,
    stripeMode: providerPayload?.mode ?? null,
    stripeChargeId: null,
    webhookEventId: null,
    createdAt: new Date().toISOString()
  };
  store.payments.push(payment);
  if (order) order.paymentId = payment.id;
  return payment;
}

export function prepareRefund(store, paymentId, amount) {
  const payment = byIdRequired(store.payments, paymentId, "payment_not_found");
  if (payment.status !== PAYMENT_STATUS.SUCCEEDED) {
    throw problem(409, "payment_not_refundable", "Only a succeeded payment can be refunded");
  }
  if (!payment.stripePaymentIntentId && !payment.stripeChargeId) {
    throw problem(409, "payment_provider_reference_missing", "Payment is missing a refundable Stripe reference");
  }
  const locallyCommittedAmount = store.refunds
    .filter((refund) => refund.paymentId === payment.id)
    .filter((refund) => !["failed", "canceled"].includes(refund.status))
    .reduce((sum, refund) => sum + refund.amount, 0);
  const committedAmount = Math.max(
    locallyCommittedAmount,
    Number.isSafeInteger(payment.stripeAmountRefunded) ? payment.stripeAmountRefunded : 0
  );
  const remainingAmount = payment.amount - committedAmount;
  if (remainingAmount <= 0) {
    throw problem(409, "payment_already_refunded", "Payment has no refundable amount remaining");
  }
  const normalizedAmount = requirePositiveInteger(amount ?? remainingAmount, "invalid_refund_amount", "amount");
  if (normalizedAmount > remainingAmount) {
    throw problem(409, "refund_amount_exceeds_remaining", "Refund amount exceeds the refundable payment amount");
  }
  return { payment, amount: normalizedAmount, remainingAmount };
}

export function recordRefund(store, paymentId, {
  amount,
  reason,
  providerRefundId,
  status = "succeeded"
} = {}) {
  const prepared = prepareRefund(store, paymentId, amount);
  const refund = {
    id: id("ref"),
    paymentId: prepared.payment.id,
    amount: prepared.amount,
    currency: prepared.payment.currency,
    status,
    reason: reason ?? "requested_by_customer",
    providerRefundId: providerRefundId ?? null,
    createdAt: new Date().toISOString()
  };
  store.refunds.push(refund);
  syncPaymentRefundStatus(store, prepared.payment);
  return { refund, payment: prepared.payment };
}

export function applyStripeEvent(store, event) {
  if (!event?.id) {
    return { applied: false, reason: "duplicate_or_missing_event_id" };
  }

  const type = event.type;
  const supportedTypes = new Set([
    "payment_intent.succeeded",
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
    "payment_intent.payment_failed",
    "charge.refunded",
    "refund.updated"
  ]);
  if (!supportedTypes.has(type)) {
    return { applied: false, reason: "unsupported_event_type" };
  }
  store.stripeEvents ??= [];
  if (
    store.stripeEvents.some((processed) => processed.eventId === event.id)
    || store.payments.some((payment) => payment.webhookEventId === event.id)
  ) {
    return { applied: false, reason: "duplicate_or_missing_event_id" };
  }

  const object = event.data?.object ?? {};
  let payment = null;

  if (object.payment_intent) {
    payment = store.payments.find((item) => item.stripePaymentIntentId === object.payment_intent);
  }
  if (!payment && object.charge) {
    payment = store.payments.find((item) => item.stripeChargeId === object.charge);
  }
  if (!payment && object.id) {
    payment = store.payments.find((item) => (
      item.stripePaymentIntentId === object.id
      || item.stripeCheckoutSessionId === object.id
      || item.stripeChargeId === object.id
    ));
  }

  if (!payment) {
    return { applied: false, reason: "payment_not_found" };
  }

  if (object.payment_intent && !payment.stripePaymentIntentId) {
    payment.stripePaymentIntentId = object.payment_intent;
  }
  if (object.latest_charge && !payment.stripeChargeId) payment.stripeChargeId = object.latest_charge;
  if (type === "charge.refunded" && object.id && !payment.stripeChargeId) {
    payment.stripeChargeId = object.id;
  }

  const checkoutCompletedAndPaid = type === "checkout.session.completed"
    && ["paid", "no_payment_required"].includes(object.payment_status);
  if (
    type === "payment_intent.succeeded"
    || type === "checkout.session.async_payment_succeeded"
    || checkoutCompletedAndPaid
  ) {
    if (payment.status !== PAYMENT_STATUS.REFUNDED) {
      payment.status = PAYMENT_STATUS.SUCCEEDED;
      markOrderPaid(store, payment.orderId, payment);
    }
  } else if (type === "checkout.session.completed") {
    if (![PAYMENT_STATUS.SUCCEEDED, PAYMENT_STATUS.REFUNDED].includes(payment.status)) {
      payment.status = PAYMENT_STATUS.PROCESSING;
    }
  } else if ([
    "payment_intent.payment_failed",
    "checkout.session.async_payment_failed",
    "checkout.session.expired"
  ].includes(type)) {
    if (![PAYMENT_STATUS.SUCCEEDED, PAYMENT_STATUS.REFUNDED].includes(payment.status)) {
      payment.status = PAYMENT_STATUS.FAILED;
      releasePendingOrderResources(
        store,
        payment.orderId,
        type === "checkout.session.expired" ? "payment_expired" : "payment_failed"
      );
    }
  } else if (type === "charge.refunded") {
    syncStripeChargeRefunds(store, payment, object);
    const amountRefunded = Number(object.amount_refunded);
    if (Number.isSafeInteger(amountRefunded) && amountRefunded >= 0) {
      payment.stripeAmountRefunded = Math.max(payment.stripeAmountRefunded ?? 0, amountRefunded);
    }
    syncPaymentRefundStatus(store, payment);
  } else if (type === "refund.updated") {
    const refund = store.refunds.find((item) => item.providerRefundId === object.id);
    if (!refund) return { applied: false, reason: "refund_not_found" };
    refund.status = mergeRefundStatus(refund.status, object.status);
    syncPaymentRefundStatus(store, payment);
  }
  payment.webhookEventId = event.id;
  store.stripeEvents.push({
    id: id("ste"),
    eventId: event.id,
    type,
    paymentId: payment.id,
    processedAt: new Date().toISOString()
  });
  return { applied: true, payment };
}

export function memberCardOperation(store, auth, cardId, operation, body = {}) {
  requireRole(auth, [ROLES.STAFF, ROLES.ADMIN]);
  const card = byIdRequired(store.memberCards, cardId, "member_card_not_found");
  normalizeMemberCardStatus(card);
  const now = new Date().toISOString();

  if (operation === "freeze") {
    const frozenUntil = new Date(body.frozenUntil ?? Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(frozenUntil.getTime()) || frozenUntil.getTime() <= Date.now()) {
      throw problem(400, "invalid_frozen_until", "frozenUntil must be a future date");
    }
    card.status = "frozen";
    card.frozenUntil = frozenUntil.toISOString();
  } else if (operation === "extend") {
    const days = requirePositiveInteger(Number(body.days ?? 30), "invalid_extension_days", "days");
    card.expiresAt = new Date(new Date(card.expiresAt).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  } else if (operation === "transfer") {
    if (!body.toUserId) throw problem(400, "missing_to_user_id", "toUserId is required");
    byIdRequired(store.users, body.toUserId, "user_not_found");
    if (body.toUserId === card.userId) throw problem(409, "same_card_owner", "Member card already belongs to this user");
    const hasOutstandingBooking = store.bookings.some((booking) => (
      booking.memberCardId === card.id
      && [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.CONFIRMED].includes(booking.status)
    ));
    if (hasOutstandingBooking) {
      throw problem(409, "card_has_active_bookings", "Member card cannot be transferred while it has active bookings");
    }
    card.transferredFromUserId = card.userId;
    card.userId = body.toUserId;
    card.transferredAt = now;
  } else if (operation === "upgrade") {
    const credits = requirePositiveInteger(Number(body.addCredits), "invalid_credit_amount", "addCredits");
    const totalCredits = requirePositiveInteger(card.totalCredits, "invalid_card_credits", "totalCredits");
    const remainingCredits = requireNonNegativeInteger(card.remainingCredits, "invalid_card_credits", "remainingCredits");
    if (!Number.isSafeInteger(totalCredits + credits) || !Number.isSafeInteger(remainingCredits + credits)) {
      throw problem(400, "invalid_credit_amount", "addCredits is too large");
    }
    card.totalCredits = totalCredits + credits;
    card.remainingCredits = remainingCredits + credits;
  } else {
    throw problem(400, "unsupported_operation", "Unsupported member-card operation");
  }

  store.cardTransactions.push({
    id: id("ctx"),
    cardId,
    userId: card.userId,
    type: operation,
    credits: operation === "upgrade" ? Number(body.addCredits) : 0,
    reason: body.reason ?? operation,
    createdAt: now
  });
  audit(store, auth, `member_card.${operation}`, card.id, body);
  return { card };
}

export function requestMembershipCancellation(store, auth, cardId, body = {}) {
  requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
  const card = byIdRequired(store.memberCards, cardId, "member_card_not_found");
  requireOwnershipOrRole(auth, card.userId, [ROLES.STAFF, ROLES.ADMIN]);
  normalizeMemberCardStatus(card);
  if (!["active", "frozen"].includes(card.status)) {
    throw problem(409, "membership_not_cancellable", "Only active or frozen memberships can be cancelled");
  }
  const existing = store.membershipCancellationRequests.find(
    (item) => item.cardId === card.id && item.status === "pending"
  );
  if (existing) return { request: existing, card };

  const now = new Date().toISOString();
  const request = {
    id: id("mcr"),
    cardId: card.id,
    userId: card.userId,
    reason: String(body.reason ?? "user_request").slice(0, 500),
    method: "in_app",
    status: "pending",
    requestedAt: now,
    contractVersion: card.contractVersion ?? null
  };
  card.autoRenew = false;
  card.autoRenewCancelledAt = now;
  store.membershipCancellationRequests.push(request);
  audit(store, auth, "membership.cancellation_requested", card.id, { requestId: request.id });
  return { request, card };
}

export function createPrivacyRequest(store, auth, body = {}) {
  requireRole(auth, [ROLES.STUDENT, ROLES.COACH, ROLES.STAFF, ROLES.ADMIN]);
  const type = String(body.type ?? "").trim().toLowerCase();
  if (!["access", "correction", "deletion", "limit"].includes(type)) {
    throw problem(400, "invalid_privacy_request_type", "Privacy request type is invalid");
  }
  const request = {
    id: id("prv"),
    userId: auth.userId,
    type,
    details: String(body.details ?? "").slice(0, 2000),
    status: "pending",
    channel: "in_app",
    requestedAt: new Date().toISOString()
  };
  store.privacyRequests.push(request);
  audit(store, auth, "privacy.request_created", request.id, { type });
  return request;
}

export function exportPrivacyData(store, auth) {
  requireRole(auth, [ROLES.STUDENT, ROLES.COACH, ROLES.STAFF, ROLES.ADMIN]);
  const userId = auth.userId;
  return {
    generatedAt: new Date().toISOString(),
    user: publicUser(byIdRequired(store.users, userId, "user_not_found")),
    bookings: store.bookings.filter((item) => item.userId === userId),
    memberCards: store.memberCards.filter((item) => item.userId === userId),
    cardTransactions: store.cardTransactions.filter((item) => item.userId === userId),
    orders: store.orders.filter((item) => item.userId === userId),
    payments: store.payments.filter((item) => item.userId === userId),
    reviews: store.reviews.filter((item) => item.userId === userId),
    bodyMetrics: store.bodyMetrics.filter((item) => item.userId === userId),
    privacyRequests: store.privacyRequests.filter((item) => item.userId === userId),
    membershipCancellationRequests: store.membershipCancellationRequests.filter((item) => item.userId === userId)
  };
}

export function deleteAccount(store, auth) {
  requireRole(auth, [ROLES.STUDENT, ROLES.COACH, ROLES.STAFF, ROLES.ADMIN]);
  const user = byIdRequired(store.users, auth.userId, "user_not_found");
  if (user.roles.includes(ROLES.ADMIN)) {
    const remainingAdmins = store.users.filter(
      (candidate) => candidate.id !== user.id && candidate.roles.includes(ROLES.ADMIN) && !candidate.deletedAt
    );
    if (!remainingAdmins.length) {
      throw problem(409, "last_admin_account", "The last administrator account cannot be deleted");
    }
  }

  const now = new Date().toISOString();
  const cancellableBookings = store.bookings.filter(
    (item) => item.userId === user.id && [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.CONFIRMED].includes(item.status)
  );
  for (const booking of cancellableBookings) cancelBooking(store, auth, booking.id, "account_deletion");

  store.authIdentities = store.authIdentities.filter((item) => item.userId !== user.id);
  store.emailVerificationChallenges = store.emailVerificationChallenges.filter((item) => item.userId !== user.id);
  for (const session of store.roleSessions.filter((item) => item.userId === user.id)) session.revokedAt = now;
  store.reviews = store.reviews.filter((item) => item.userId !== user.id);
  store.bodyMetrics = store.bodyMetrics.filter((item) => item.userId !== user.id);
  user.name = "Deleted User";
  user.email = undefined;
  user.phone = undefined;
  user.avatarUrl = undefined;
  user.avatarObjectKey = undefined;
  user.roles = [];
  user.deletedAt = now;
  user.deletionStatus = "completed";
  audit(store, auth, "privacy.account_deleted", user.id, { completedAt: now });
  return { ok: true, completedAt: now };
}

export function requireRole(auth, roles) {
  if (!auth || !roles.includes(auth.activeRole)) {
    throw problem(403, "forbidden", "Insufficient role permission");
  }
}

export function requireOwnershipOrRole(auth, ownerId, elevatedRoles) {
  if (auth?.userId === ownerId) return;
  requireRole(auth, elevatedRoles);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl ?? null,
    locale: user.locale,
    roles: user.roles
  };
}

export function problem(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

export function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function byId(collection, idValue) {
  return collection.find((item) => item.id === idValue);
}

export function byIdRequired(collection, idValue, code) {
  const entity = byId(collection, idValue);
  if (!entity) throw problem(404, code, code.replaceAll("_", " "));
  return entity;
}

export function normalizeIdentity(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeEmail(value) {
  const normalized = normalizeIdentity(value);
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) ? normalized : "";
}

function isStrongPassword(password) {
  const value = String(password ?? "");
  return value.length >= 8 && value.length <= 128 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function hashVerificationCode(code, salt) {
  return crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function createEmailVerificationChallenge(store, userId, email) {
  const code = String(crypto.randomInt(100000, 1000000));
  const codeSalt = crypto.randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const challenge = {
    id: id("evc"),
    userId,
    email,
    codeHash: hashVerificationCode(code, codeSalt),
    codeSalt,
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    consumedAt: null
  };
  store.emailVerificationChallenges.push(challenge);
  return { challenge, code };
}

function verificationCodeMatches(code, expectedHash, salt) {
  const actual = Buffer.from(hashVerificationCode(code, salt), "hex");
  const expected = Buffer.from(String(expectedHash ?? ""), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function audit(store, auth, action, entityId, metadata) {
  store.auditLogs.push({
    id: id("aud"),
    actorUserId: auth?.userId ?? "system",
    actorRole: auth?.activeRole ?? "system",
    action,
    entityId,
    metadata,
    createdAt: new Date().toISOString()
  });
}

function createOrderInternal(store, userId, items) {
  validateOrderItems(items);
  const currency = items[0].currency;
  const totalAmount = items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
  if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
    throw problem(400, "invalid_order_total", "Order total must be a positive safe integer");
  }
  const order = {
    id: id("ord"),
    userId,
    status: "pending_payment",
    totalAmount,
    currency,
    paymentId: null,
    createdAt: new Date().toISOString()
  };
  store.orders.push(order);
  for (const item of items) {
    store.orderItems.push({
      id: id("oit"),
      orderId: order.id,
      ...item
    });
  }
  return order;
}

function markOrderPaid(store, orderId, payment) {
  if (!orderId) return;
  const order = byId(store.orders, orderId);
  const booking = store.bookings.find((item) => item.orderId === orderId);
  if (order?.resourcesReleasedAt || booking?.status === BOOKING_STATUS.CANCELLED) {
    if (order) order.status = "refund_required";
    if (payment) payment.refundStatus = "refund_required";
    return;
  }
  if (order) order.status = "paid";
  if (booking && booking.status === BOOKING_STATUS.PENDING_PAYMENT) {
    booking.status = BOOKING_STATUS.CONFIRMED;
  }
}

function syncPaymentRefundStatus(store, payment) {
  const paymentRefunds = store.refunds.filter((refund) => refund.paymentId === payment.id);
  const succeededAmount = paymentRefunds
    .filter((refund) => refund.status === "succeeded")
    .reduce((sum, refund) => sum + refund.amount, 0);
  const hasPending = paymentRefunds.some((refund) => !["succeeded", "failed", "canceled"].includes(refund.status));
  const providerAmount = Number.isSafeInteger(payment.stripeAmountRefunded)
    ? payment.stripeAmountRefunded
    : 0;
  const effectiveSucceededAmount = Math.max(succeededAmount, providerAmount);
  if (payment.status === PAYMENT_STATUS.REFUNDED) {
    payment.refundStatus = "refunded";
    return;
  }
  if (effectiveSucceededAmount >= payment.amount) {
    payment.status = PAYMENT_STATUS.REFUNDED;
    payment.refundStatus = "refunded";
    releaseBookingReservation(store, payment.orderId, "payment_refunded", [
      BOOKING_STATUS.PENDING_PAYMENT,
      BOOKING_STATUS.CONFIRMED
    ]);
    const order = byId(store.orders, payment.orderId);
    if (order) order.status = "refunded";
  } else if (effectiveSucceededAmount > 0) {
    if (payment.status !== PAYMENT_STATUS.REFUNDED) payment.status = PAYMENT_STATUS.SUCCEEDED;
    payment.refundStatus = "partially_refunded";
  } else {
    payment.refundStatus = hasPending ? "pending" : "none";
  }
}

function syncStripeChargeRefunds(store, payment, charge) {
  const providerRefunds = Array.isArray(charge.refunds?.data) ? charge.refunds.data : [];
  for (const providerRefund of providerRefunds) {
    if (!providerRefund?.id || !Number.isSafeInteger(providerRefund.amount) || providerRefund.amount <= 0) continue;
    const existing = store.refunds.find((refund) => refund.providerRefundId === providerRefund.id);
    if (existing) {
      existing.status = mergeRefundStatus(existing.status, providerRefund.status);
      continue;
    }
    store.refunds.push({
      id: id("ref"),
      paymentId: payment.id,
      amount: providerRefund.amount,
      currency: String(providerRefund.currency ?? payment.currency).toUpperCase(),
      status: providerRefund.status ?? "pending",
      reason: providerRefund.reason ?? "requested_by_customer",
      providerRefundId: providerRefund.id,
      createdAt: Number.isSafeInteger(providerRefund.created)
        ? new Date(providerRefund.created * 1000).toISOString()
        : new Date().toISOString()
    });
  }
}

function mergeRefundStatus(currentStatus, incomingStatus) {
  if (!incomingStatus) return currentStatus;
  const terminalStatuses = new Set(["succeeded", "failed", "canceled"]);
  if (terminalStatuses.has(currentStatus)) return currentStatus;
  return incomingStatus;
}

function validateOrderItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw problem(400, "empty_order", "Order must contain at least one item");
  }
  const currency = String(items[0].currency ?? "").toUpperCase();
  if (!currency || items.some((item) => String(item.currency ?? "").toUpperCase() !== currency)) {
    throw problem(400, "mixed_currency_order", "Order items must use one currency");
  }
  for (const item of items) {
    requirePositiveInteger(item.quantity, "invalid_quantity", "quantity");
    requirePositiveInteger(item.unitAmount, "invalid_unit_amount", "unitAmount");
  }
}

function requirePositiveInteger(value, code, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw problem(400, code, `${fieldName} must be a positive integer`);
  }
  return value;
}

function requireNonNegativeInteger(value, code, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw problem(400, code, `${fieldName} must be a non-negative integer`);
  }
  return value;
}

export function normalizeMemberCardStatus(card, now = Date.now()) {
  if (
    card?.status === "frozen"
    && Number.isFinite(new Date(card.frozenUntil).getTime())
    && new Date(card.frozenUntil).getTime() <= now
  ) {
    card.status = "active";
    card.unfrozenAt = new Date(now).toISOString();
  }
  return card;
}

export function releasePendingOrderResources(store, orderId, reason = "payment_failed") {
  const order = byId(store.orders, orderId);
  if (order?.resourcesReleasedAt) return null;
  const released = releaseBookingReservation(
    store,
    orderId,
    reason,
    [BOOKING_STATUS.PENDING_PAYMENT]
  );
  if (order) {
    for (const item of store.orderItems.filter((candidate) => candidate.orderId === order.id && candidate.type === "product")) {
      const product = byId(store.products, item.refId);
      if (product) product.stock = requireNonNegativeInteger(product.stock, "invalid_product_stock", "stock") + item.quantity;
    }
  }
  if (order && order.status === "pending_payment") {
    order.status = reason;
    order.resourcesReleasedAt = new Date().toISOString();
  }
  return released;
}

function releaseBookingReservation(store, orderId, reason, eligibleStatuses) {
  if (!orderId) return null;
  const booking = store.bookings.find((candidate) => candidate.orderId === orderId);
  if (!booking || !eligibleStatuses.includes(booking.status)) return booking ?? null;
  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelReason = reason;
  booking.cancelledAt = new Date().toISOString();
  const session = byId(store.courseSessions, booking.courseSessionId);
  if (session) session.bookedCount = Math.max(0, Number(session.bookedCount ?? 0) - 1);
  return booking;
}

function requireFutureSession(session, now = Date.now()) {
  const startsAt = new Date(session?.startsAt).getTime();
  const endsAt = new Date(session?.endsAt).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    throw problem(409, "invalid_session_time", "Course session has an invalid time range");
  }
  if (startsAt <= now) {
    throw problem(409, "session_started", "Course session has already started");
  }
  return session;
}

function withIdempotency(store, key, scope, handler) {
  if (!key) {
    throw problem(400, "missing_idempotency_key", "Idempotency-Key header is required");
  }
  const existing = store.idempotencyRecords.find((record) => record.key === key && record.scope === scope);
  if (existing) return existing.response;
  const response = handler();
  store.idempotencyRecords.push({
    id: id("idem"),
    key,
    scope,
    response,
    createdAt: new Date().toISOString()
  });
  return response;
}

function isMethodEligible(method, currency, country) {
  const currencyOk = method.currencies.includes("*") || method.currencies.includes(currency);
  const countryOk = isCountryEligible(method, country);
  return currencyOk && countryOk;
}

function isCountryEligible(method, country) {
  return method.countries.includes("*")
    || method.countries.includes(country)
    || (method.countries.includes("EU") && EU_COUNTRIES.has(country));
}
