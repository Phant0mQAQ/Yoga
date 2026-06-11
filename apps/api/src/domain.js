import crypto from "node:crypto";

export const ROLES = Object.freeze({
  STUDENT: "student",
  COACH: "coach",
  STAFF: "staff",
  ADMIN: "admin"
});

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

export const DEMO_PASSWORD = "Yomi@2026";

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
    display: { en: "International Cards", zh: "国际银行卡", ko: "해외 카드" },
    currencies: ["*"],
    countries: ["*"],
    flow: "native_or_checkout",
    recurring: true
  },
  {
    code: "link",
    family: "wallet",
    display: { en: "Link", zh: "Link 快捷支付", ko: "Link" },
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
    countries: ["CN", "HK", "SG", "US", "GB", "EU"],
    flow: "redirect",
    recurring: false
  },
  {
    code: "wechat_pay",
    family: "local_wallet",
    display: { en: "WeChat Pay", zh: "微信支付", ko: "WeChat Pay" },
    currencies: ["AUD", "CAD", "CHF", "CNY", "DKK", "EUR", "GBP", "HKD", "JPY", "NOK", "SEK", "SGD", "USD"],
    countries: ["CN", "HK", "SG", "US", "GB", "EU"],
    flow: "checkout_redirect",
    recurring: false
  },
  {
    code: "kr_card",
    family: "card",
    display: { en: "Korean Cards", zh: "韩国本地银行卡", ko: "국내 카드" },
    currencies: ["KRW"],
    countries: ["KR"],
    flow: "redirect",
    recurring: true
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
        phone: "+85250000001",
        locale: "en",
        roles: [ROLES.STUDENT],
        createdAt: now.toISOString()
      },
      {
        id: "usr_coach",
        name: "Sora Kim",
        email: "coach@example.com",
        phone: "+85250000002",
        locale: "ko",
        roles: [ROLES.COACH],
        createdAt: now.toISOString()
      },
      {
        id: "usr_staff",
        name: "Studio Staff",
        email: "staff@example.com",
        phone: "+85250000003",
        locale: "en",
        roles: [ROLES.STAFF],
        createdAt: now.toISOString()
      },
      {
        id: "usr_admin",
        name: "Admin",
        email: "admin@example.com",
        phone: "+85250000004",
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
        title: tr("Morning Flow", "晨间流瑜伽", "모닝 플로우"),
        description: tr("A balanced vinyasa class for all levels.", "适合各水平的流瑜伽课程。", "모든 레벨을 위한 빈야사 수업입니다."),
        durationMinutes: 60,
        priceAmount: 38000,
        currency: "KRW",
        capacity: 8,
        memberCardDeductCount: 1,
        tags: ["vinyasa", "mobility"]
      },
      {
        id: "course_private",
        categoryId: "cat_private",
        title: tr("Private Alignment", "私教体态矫正", "개인 자세 교정"),
        description: tr("One-on-one class with posture assessment.", "一对一体态评估与练习。", "자세 평가가 포함된 1:1 레슨입니다."),
        durationMinutes: 75,
        priceAmount: 88000,
        currency: "KRW",
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
        timezone: "Asia/Hong_Kong"
      }
    ],
    bookings: [],
    checkIns: [],
    membershipPlans: [
      {
        id: "plan_10",
        title: tr("10-Class Card", "10 次卡", "10회권"),
        totalCredits: 10,
        priceAmount: 320000,
        currency: "KRW",
        validityDays: 180,
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
        frozenUntil: null
      }
    ],
    cardTransactions: [],
    products: [
      {
        id: "prod_mat",
        title: tr("Studio Yoga Mat", "专业瑜伽垫", "스튜디오 요가 매트"),
        description: tr("Non-slip mat for studio practice.", "防滑专业练习垫。", "스튜디오 연습용 논슬립 매트입니다."),
        category: "yoga_mat",
        priceAmount: 42000,
        currency: "KRW",
        stock: 20
      }
    ],
    orders: [],
    orderItems: [],
    payments: [],
    refunds: [],
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
    auditLogs: [],
    idempotencyRecords: []
  };
  repairKnownTranslations(store);
  return store;
}

export function repairKnownTranslations(store) {
  let changed = false;
  const repair = (current, corrected) => {
    if (!current || typeof current !== "object") return current;
    const serialized = JSON.stringify(current);
    if (!/[鍥绉鐟娴鞖雼靷鏅]/.test(serialized) && !serialized.includes("?")) {
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

const PAYMENT_METHOD_LABELS = Object.freeze({
  card: { en: "International Cards", zh: "国际银行卡", "zh-Hans": "国际银行卡", ko: "해외 카드" },
  link: { en: "Link", zh: "Link 快捷支付", "zh-Hans": "Link 快捷支付", ko: "Link" },
  paypal: { en: "PayPal", zh: "PayPal", "zh-Hans": "PayPal", ko: "PayPal" },
  alipay: { en: "Alipay", zh: "支付宝", "zh-Hans": "支付宝", ko: "Alipay" },
  wechat_pay: { en: "WeChat Pay", zh: "微信支付", "zh-Hans": "微信支付", ko: "WeChat Pay" },
  kr_card: { en: "Korean Cards", zh: "韩国本地银行卡", "zh-Hans": "韩国本地银行卡", ko: "국내 카드" },
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

export function login(store, { email, password, role, locale = "en" }, signToken) {
  const normalizedEmail = normalizeIdentity(email);
  if (!normalizedEmail || !password || !Object.values(ROLES).includes(role)) {
    throw problem(400, "invalid_login_request", "Email, password, and a valid role are required");
  }

  const identity = store.authIdentities.find(
    (item) => item.type === "email" && item.value === normalizedEmail
  );
  if (!identity || !verifyPassword(password, identity.passwordHash)) {
    throw problem(401, "invalid_credentials", "Email or password is incorrect");
  }

  const user = byId(store.users, identity.userId);
  if (!user) {
    throw problem(401, "invalid_credentials", "Email or password is incorrect");
  }
  if (!user.roles.includes(role)) {
    throw problem(403, "role_not_allowed", `User cannot log in as ${role}`);
  }

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

export function getPaymentMethods({ currency = "HKD", country = "HK", recurring = false } = {}) {
  const normalizedCurrency = currency.toUpperCase();
  const normalizedCountry = country.toUpperCase();
  return PAYMENT_METHODS.filter((method) => {
    const currencyOk = method.currencies.includes("*") || method.currencies.includes(normalizedCurrency);
    const countryOk = method.countries.includes("*") || method.countries.includes(normalizedCountry) || method.countries.includes("EU");
    const recurringOk = !recurring || method.recurring;
    return currencyOk && countryOk && recurringOk;
  }).map((method) => ({
    ...method,
    display: PAYMENT_METHOD_LABELS[method.code] ?? method.display,
    cardDisplayGroup: method.code === "card" || method.code === "kr_card" ? "cards" : undefined
  }));
}

export function createBooking(store, auth, body, idempotencyKey) {
  requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
  return withIdempotency(store, idempotencyKey, "createBooking", () => {
    const courseSession = byIdRequired(store.courseSessions, body.courseSessionId, "course_session_not_found");
    const course = byIdRequired(store.courses, courseSession.courseId, "course_not_found");
    if (courseSession.status !== "open") {
      throw problem(409, "session_closed", "Course session is not open");
    }
    if (courseSession.bookedCount >= courseSession.capacity) {
      throw problem(409, "session_full", "Course session is full");
    }

    const userId = auth.activeRole === ROLES.STUDENT ? auth.userId : body.userId;
    if (!userId) throw problem(400, "missing_user_id", "userId is required for staff/admin booking");

    const activeCard = store.memberCards.find((card) => card.userId === userId && card.status === "active");
    const shouldUseCard = body.paymentMode === "member_card";
    let status = BOOKING_STATUS.PENDING_PAYMENT;
    let order = null;

    if (shouldUseCard) {
      if (!activeCard) throw problem(409, "no_active_card", "User has no active member card");
      if (activeCard.remainingCredits < course.memberCardDeductCount) {
        throw problem(409, "insufficient_credits", "Member card does not have enough credits");
      }
      activeCard.remainingCredits -= course.memberCardDeductCount;
      store.cardTransactions.push({
        id: id("ctx"),
        cardId: activeCard.id,
        userId,
        type: "deduct",
        credits: -course.memberCardDeductCount,
        reason: "booking",
        createdAt: new Date().toISOString()
      });
      status = BOOKING_STATUS.CONFIRMED;
    } else {
      order = createOrderInternal(store, userId, [{
        type: "course_session",
        refId: courseSession.id,
        title: course.title,
        quantity: 1,
        unitAmount: course.priceAmount,
        currency: course.currency
      }]);
    }

    courseSession.bookedCount += 1;
    const booking = {
      id: id("bkg"),
      userId,
      courseId: course.id,
      courseSessionId: courseSession.id,
      coachId: courseSession.coachId,
      orderId: order?.id ?? null,
      memberCardId: shouldUseCard ? activeCard.id : null,
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

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelledAt = new Date().toISOString();
  booking.cancelReason = reason;
  const session = byId(store.courseSessions, booking.courseSessionId);
  if (session) session.bookedCount = Math.max(0, session.bookedCount - 1);

  if (booking.memberCardId) {
    const card = byId(store.memberCards, booking.memberCardId);
    const course = byId(store.courses, booking.courseId);
    if (card && course) {
      card.remainingCredits += course.memberCardDeductCount;
      store.cardTransactions.push({
        id: id("ctx"),
        cardId: card.id,
        userId: booking.userId,
        type: "refund",
        credits: course.memberCardDeductCount,
        reason: "booking_cancelled",
        createdAt: new Date().toISOString()
      });
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
  if (nextSession.status !== "open" || nextSession.bookedCount >= nextSession.capacity) {
    throw problem(409, "next_session_unavailable", "Next session is unavailable");
  }
  const previousSession = byId(store.courseSessions, booking.courseSessionId);
  if (previousSession) previousSession.bookedCount = Math.max(0, previousSession.bookedCount - 1);
  nextSession.bookedCount += 1;
  booking.courseSessionId = nextSession.id;
  booking.courseId = nextSession.courseId;
  booking.coachId = nextSession.coachId;
  booking.startsAt = nextSession.startsAt;
  booking.endsAt = nextSession.endsAt;
  booking.updatedAt = new Date().toISOString();
  audit(store, auth, "booking.reschedule", booking.id, { nextSessionId });
  return { booking };
}

export function checkInBooking(store, auth, bookingId, method = "manual") {
  requireRole(auth, [ROLES.COACH, ROLES.STAFF, ROLES.ADMIN]);
  const booking = byIdRequired(store.bookings, bookingId, "booking_not_found");
  if (![BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING_PAYMENT].includes(booking.status)) {
    throw problem(409, "not_checkin_eligible", "Booking cannot be checked in");
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

export function createOrder(store, auth, body, idempotencyKey) {
  requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
  return withIdempotency(store, idempotencyKey, "createOrder", () => {
    const userId = auth.activeRole === ROLES.STUDENT ? auth.userId : body.userId;
    const items = (body.items ?? []).map((item) => {
      const product = byIdRequired(store.products, item.productId, "product_not_found");
      if (product.stock < item.quantity) throw problem(409, "insufficient_stock", "Product stock is insufficient");
      product.stock -= item.quantity;
      return {
        type: "product",
        refId: product.id,
        title: product.title,
        quantity: item.quantity,
        unitAmount: product.priceAmount,
        currency: product.currency
      };
    });
    const order = createOrderInternal(store, userId, items);
    audit(store, auth, "order.create", order.id, {});
    return { order };
  });
}

export function createPaymentRecord(store, auth, { orderId, amount, currency, country, methodCode, providerPayload }) {
  requireRole(auth, [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN]);
  const order = orderId ? byIdRequired(store.orders, orderId, "order_not_found") : null;
  const method = PAYMENT_METHODS.find((item) => item.code === methodCode);
  if (!method) throw problem(400, "unsupported_payment_method", "Unsupported payment method");
  const normalizedCurrency = (currency ?? order?.currency ?? "HKD").toUpperCase();
  const normalizedCountry = (country ?? "HK").toUpperCase();
  if (!isMethodEligible(method, normalizedCurrency, normalizedCountry)) {
    throw problem(400, "payment_method_not_eligible", `${methodCode} is not eligible for ${normalizedCurrency}/${normalizedCountry}`);
  }
  const payment = {
    id: id("pay"),
    orderId: order?.id ?? null,
    userId: order?.userId ?? auth.userId,
    paymentProvider: "stripe",
    paymentMethodFamily: method.family,
    paymentMethodCode: method.code,
    amount: amount ?? order?.totalAmount,
    currency: normalizedCurrency,
    country: normalizedCountry,
    status: PAYMENT_STATUS.REQUIRES_PAYMENT,
    refundStatus: "none",
    stripePaymentIntentId: providerPayload?.paymentIntentId ?? null,
    stripeCheckoutSessionId: providerPayload?.checkoutSessionId ?? null,
    stripeChargeId: null,
    webhookEventId: null,
    createdAt: new Date().toISOString()
  };
  store.payments.push(payment);
  if (order) order.paymentId = payment.id;
  return payment;
}

export function applyStripeEvent(store, event) {
  if (!event?.id || store.payments.some((payment) => payment.webhookEventId === event.id)) {
    return { applied: false, reason: "duplicate_or_missing_event_id" };
  }

  const type = event.type;
  const object = event.data?.object ?? {};
  let payment = null;

  if (object.payment_intent) {
    payment = store.payments.find((item) => item.stripePaymentIntentId === object.payment_intent);
  }
  if (!payment && object.id) {
    payment = store.payments.find((item) => item.stripePaymentIntentId === object.id || item.stripeCheckoutSessionId === object.id);
  }

  if (!payment) {
    return { applied: false, reason: "payment_not_found" };
  }

  payment.webhookEventId = event.id;
  if (type === "payment_intent.succeeded" || type === "checkout.session.completed") {
    payment.status = PAYMENT_STATUS.SUCCEEDED;
    if (object.latest_charge) payment.stripeChargeId = object.latest_charge;
    markOrderPaid(store, payment.orderId);
  } else if (type === "payment_intent.payment_failed") {
    payment.status = PAYMENT_STATUS.FAILED;
  } else if (type === "charge.refunded" || type === "refund.updated") {
    payment.refundStatus = "refunded";
    payment.status = PAYMENT_STATUS.REFUNDED;
  }
  return { applied: true, payment };
}

export function memberCardOperation(store, auth, cardId, operation, body = {}) {
  requireRole(auth, [ROLES.STAFF, ROLES.ADMIN]);
  const card = byIdRequired(store.memberCards, cardId, "member_card_not_found");
  const now = new Date().toISOString();

  if (operation === "freeze") {
    card.status = "frozen";
    card.frozenUntil = body.frozenUntil ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (operation === "extend") {
    const days = Number(body.days ?? 30);
    card.expiresAt = new Date(new Date(card.expiresAt).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  } else if (operation === "transfer") {
    if (!body.toUserId) throw problem(400, "missing_to_user_id", "toUserId is required");
    card.userId = body.toUserId;
    card.status = "transferred";
  } else if (operation === "upgrade") {
    const credits = Number(body.addCredits ?? 0);
    card.totalCredits += credits;
    card.remainingCredits += credits;
    card.status = "upgraded";
  } else {
    throw problem(400, "unsupported_operation", "Unsupported member-card operation");
  }

  store.cardTransactions.push({
    id: id("ctx"),
    cardId,
    userId: card.userId,
    type: operation,
    credits: Number(body.addCredits ?? 0),
    reason: body.reason ?? operation,
    createdAt: now
  });
  audit(store, auth, `member_card.${operation}`, card.id, body);
  return { card };
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
  if (!items.length) throw problem(400, "empty_order", "Order must contain at least one item");
  const currency = items[0].currency;
  if (items.some((item) => item.currency !== currency)) {
    throw problem(400, "mixed_currency_order", "Order items must use one currency");
  }
  const order = {
    id: id("ord"),
    userId,
    status: "pending_payment",
    totalAmount: items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0),
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

function markOrderPaid(store, orderId) {
  if (!orderId) return;
  const order = byId(store.orders, orderId);
  if (order) order.status = "paid";
  const booking = store.bookings.find((item) => item.orderId === orderId);
  if (booking && booking.status === BOOKING_STATUS.PENDING_PAYMENT) {
    booking.status = BOOKING_STATUS.CONFIRMED;
  }
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
  const countryOk = method.countries.includes("*") || method.countries.includes(country) || method.countries.includes("EU");
  return currencyOk && countryOk;
}
