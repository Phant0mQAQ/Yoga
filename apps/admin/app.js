const SUPPORTED_LOCALES = ["en", "zh-Hans", "ko"];
const DEFAULT_LOCALE = "en";
const LOCALE_STORAGE_KEY = "yomi-admin-locale";

const messages = {
  en: {
    pageTitle: "Yomi Yoga Studio",
    language: "Language",
    adminNavigation: "Admin navigation",
    overview: "Overview",
    members: "Members",
    schedule: "Schedule",
    content: "Content",
    commerce: "Commerce",
    settings: "Settings",
    apiConnected: "API connected",
    studioOperations: "STUDIO OPERATIONS",
    greeting: "Good morning, Admin.",
    subtitle: "Here is what is happening across Yomi Yoga today.",
    refresh: "Refresh",
    secureWorkspace: "SECURE WORKSPACE",
    signInTitle: "Sign in to Yomi Studio OS",
    signInDescription: "Manage members, classes, payments, content, and front-desk operations from one workspace.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    loginHint: "Use the administrator credentials configured for this environment.",
    courses: "Courses",
    bookings: "Bookings",
    memberCards: "Member cards",
    payments: "Payments",
    today: "TODAY",
    classAvailability: "Class availability",
    createDemoBooking: "Create demo booking",
    course: "Course",
    coach: "Coach",
    start: "Start",
    open: "Open",
    frontDesk: "FRONT DESK",
    recentBookings: "Recent bookings",
    member: "Member",
    status: "Status",
    checkIn: "Check in",
    noBookings: "No bookings yet.",
    paymentMethods: "Payment methods",
    hongKong: "Hong Kong",
    southKorea: "South Korea",
    china: "China",
    unitedStates: "United States",
    refreshMethods: "Refresh methods",
    security: "SECURITY",
    auditHistory: "Audit history",
    readOnly: "Read only",
    time: "Time",
    actor: "Actor",
    action: "Action",
    entity: "Entity",
    methodDetails: "{code} · {family} · {flow}",
    confirmed: "Confirmed",
    checked_in: "Checked in",
    cancelled: "Cancelled",
    pending_payment: "Pending payment",
    requestFailed: "Request failed"
  },
  "zh-Hans": {
    pageTitle: "Yomi Yoga 管理后台",
    language: "语言",
    adminNavigation: "后台导航",
    overview: "概览",
    members: "会员",
    schedule: "排课",
    content: "内容",
    commerce: "商城",
    settings: "设置",
    apiConnected: "API 已连接",
    studioOperations: "场馆运营",
    greeting: "管理员，早上好。",
    subtitle: "以下是 Yomi Yoga 今天的运营情况。",
    refresh: "刷新",
    secureWorkspace: "安全工作区",
    signInTitle: "登录 Yomi Studio OS",
    signInDescription: "在一个工作区管理会员、课程、支付、内容和前台运营。",
    email: "邮箱",
    password: "密码",
    signIn: "登录",
    loginHint: "请使用为当前环境配置的管理员账号。",
    courses: "课程",
    bookings: "预约",
    memberCards: "会员卡",
    payments: "支付",
    today: "今日",
    classAvailability: "课程余位",
    createDemoBooking: "创建演示预约",
    course: "课程",
    coach: "教练",
    start: "开始时间",
    open: "余位",
    frontDesk: "前台",
    recentBookings: "最近预约",
    member: "会员",
    status: "状态",
    checkIn: "核销",
    noBookings: "暂无预约。",
    paymentMethods: "支付方式",
    hongKong: "中国香港",
    southKorea: "韩国",
    china: "中国大陆",
    unitedStates: "美国",
    refreshMethods: "刷新支付方式",
    security: "安全",
    auditHistory: "审计记录",
    readOnly: "只读",
    time: "时间",
    actor: "操作角色",
    action: "操作",
    entity: "对象",
    methodDetails: "{code} · {family} · {flow}",
    confirmed: "已确认",
    checked_in: "已核销",
    cancelled: "已取消",
    pending_payment: "待支付",
    requestFailed: "请求失败"
  },
  ko: {
    pageTitle: "Yomi Yoga 관리자",
    language: "언어",
    adminNavigation: "관리자 탐색",
    overview: "개요",
    members: "회원",
    schedule: "일정",
    content: "콘텐츠",
    commerce: "스토어",
    settings: "설정",
    apiConnected: "API 연결됨",
    studioOperations: "스튜디오 운영",
    greeting: "관리자님, 좋은 아침입니다.",
    subtitle: "오늘 Yomi Yoga의 운영 현황입니다.",
    refresh: "새로고침",
    secureWorkspace: "보안 작업 공간",
    signInTitle: "Yomi Studio OS 로그인",
    signInDescription: "회원, 수업, 결제, 콘텐츠 및 프런트 운영을 한곳에서 관리하세요.",
    email: "이메일",
    password: "비밀번호",
    signIn: "로그인",
    loginHint: "이 환경에 설정된 관리자 계정을 사용하세요.",
    courses: "수업",
    bookings: "예약",
    memberCards: "회원권",
    payments: "결제",
    today: "오늘",
    classAvailability: "수업 예약 가능 현황",
    createDemoBooking: "데모 예약 만들기",
    course: "수업",
    coach: "강사",
    start: "시작",
    open: "잔여석",
    frontDesk: "프런트",
    recentBookings: "최근 예약",
    member: "회원",
    status: "상태",
    checkIn: "체크인",
    noBookings: "예약이 없습니다.",
    paymentMethods: "결제 수단",
    hongKong: "홍콩",
    southKorea: "대한민국",
    china: "중국",
    unitedStates: "미국",
    refreshMethods: "결제 수단 새로고침",
    security: "보안",
    auditHistory: "감사 기록",
    readOnly: "읽기 전용",
    time: "시간",
    actor: "작업자",
    action: "작업",
    entity: "대상",
    methodDetails: "{code} · {family} · {flow}",
    confirmed: "확정",
    checked_in: "체크인 완료",
    cancelled: "취소됨",
    pending_payment: "결제 대기",
    requestFailed: "요청 실패"
  }
};

let token = "";
let locale = readStoredLocale();
let dashboardData = null;
const API_BASE_URL = normalizeBaseUrl(window.YOMI_CONFIG?.apiBaseUrl ?? "");

const el = (id) => document.getElementById(id);

el("locale").value = locale;
applyTranslations();

el("locale").addEventListener("change", async (event) => {
  locale = normalizeLocale(event.target.value);
  storeLocale(locale);
  applyTranslations();
  if (token) {
    await runAction(loadDashboard);
  } else if (dashboardData) {
    renderDashboardData(dashboardData);
  }
});
el("loginBtn").addEventListener("click", login);
el("refreshBtn").addEventListener("click", () => runAction(loadDashboard));
el("demoBookingBtn").addEventListener("click", () => runAction(createDemoBooking));
el("loadMethodsBtn").addEventListener("click", () => runAction(loadPaymentMethods));
el("country").addEventListener("change", syncCurrencyForCountry);

async function login() {
  try {
    const response = await api("/auth/login", {
      method: "POST",
      body: {
        email: el("email").value.trim().toLowerCase(),
        password: el("password").value,
        role: "admin",
        locale
      }
    });
    token = response.token;
    el("loginPanel").hidden = true;
    el("summaryGrid").hidden = false;
    el("contentPanel").hidden = false;
    el("paymentPanel").hidden = false;
    el("auditPanel").hidden = false;
    await loadDashboard();
  } catch (error) {
    el("loginHint").textContent = error.message;
  }
}

async function loadDashboard() {
  if (!token) return;
  const [courses, bookings, memberCards, payments, availability, auditLogs] = await Promise.all([
    api(`/admin/courses?locale=${encodeURIComponent(locale)}`),
    api(`/bookings?locale=${encodeURIComponent(locale)}`),
    api("/admin/member-cards"),
    api("/admin/payments"),
    api(`/availability?locale=${encodeURIComponent(locale)}`),
    api("/admin/audit-logs")
  ]);

  dashboardData = { courses, bookings, memberCards, payments, availability, auditLogs };
  renderDashboardData(dashboardData);
  await loadPaymentMethods();
}

function renderDashboardData(data) {
  el("courseCount").textContent = data.courses.length;
  el("bookingCount").textContent = data.bookings.length;
  el("memberCardCount").textContent = data.memberCards.length;
  el("paymentCount").textContent = data.payments.length;
  renderAvailability(data.availability);
  renderBookings(data.bookings);
  renderAudit(data.auditLogs);
}

function renderAvailability(rows) {
  el("availabilityRows").innerHTML = rows.map((item) => `
    <tr>
      <td>${escapeHtml(item.course?.title ?? item.courseId)}</td>
      <td>${escapeHtml(item.coach?.name ?? item.coachId)}</td>
      <td>${formatDate(item.startsAt)}</td>
      <td>${item.remainingCapacity}</td>
    </tr>
  `).join("");
}

function renderBookings(rows) {
  el("bookingRows").innerHTML = rows.length ? rows.map((item) => `
    <tr>
      <td>${escapeHtml(item.user?.name ?? item.userId)}</td>
      <td>${escapeHtml(item.course?.title ?? item.courseId)}</td>
      <td>${escapeHtml(t(item.status, item.status))}</td>
      <td>
        ${item.status === "confirmed" ? `<button class="secondary" data-checkin="${item.id}">${escapeHtml(t("checkIn"))}</button>` : ""}
      </td>
    </tr>
  `).join("") : `<tr><td colspan="4">${escapeHtml(t("noBookings"))}</td></tr>`;

  document.querySelectorAll("[data-checkin]").forEach((button) => {
    button.addEventListener("click", () => {
      runAction(async () => {
        await api(`/bookings/${button.dataset.checkin}/check-in`, {
          method: "POST",
          body: { method: "manual" }
        });
        await loadDashboard();
      });
    });
  });
}

function renderAudit(rows) {
  el("auditRows").innerHTML = rows.slice(-12).reverse().map((item) => `
    <tr>
      <td>${formatDate(item.createdAt)}</td>
      <td>${escapeHtml(item.actorRole)}</td>
      <td>${escapeHtml(item.action)}</td>
      <td>${escapeHtml(item.entityId)}</td>
    </tr>
  `).join("");
}

async function createDemoBooking() {
  const availability = await api(`/availability?locale=${encodeURIComponent(locale)}`);
  const first = availability[0];
  if (!first) return;

  const adminToken = token;
  try {
    const studentLogin = await api("/auth/login", {
      method: "POST",
      body: {
        email: "student@example.com",
        password: "Yomi@2026",
        role: "student",
        locale
      }
    });
    token = studentLogin.token;
    await api("/bookings", {
      method: "POST",
      idempotencyKey: `demo-${Date.now()}`,
      body: {
        courseSessionId: first.id,
        paymentMode: "member_card"
      }
    });
  } finally {
    token = adminToken;
  }
  await loadDashboard();
}

async function loadPaymentMethods() {
  const country = el("country").value;
  const currency = el("currency").value;
  const methods = await api(`/payments/methods?country=${country}&currency=${currency}&locale=${encodeURIComponent(locale)}`);
  el("paymentMethods").innerHTML = methods.map((method) => `
    <div class="method">
      <strong>${escapeHtml(method.display?.[locale] ?? method.display?.en ?? method.code)}</strong>
      <span>${escapeHtml(interpolate(t("methodDetails"), {
        code: method.code,
        family: method.family,
        flow: method.flow
      }))}</span>
    </div>
  `).join("");
}

function syncCurrencyForCountry() {
  const currencyByCountry = { KR: "KRW", HK: "HKD", CN: "CNY", US: "USD" };
  el("currency").value = currencyByCountry[el("country").value] ?? "USD";
}

async function api(url, options = {}) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? t("requestFailed"));
  }
  return data;
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    el("loginHint").textContent = error.message;
    console.error(error);
  }
}

function applyTranslations() {
  document.documentElement.lang = locale;
  document.title = t("pageTitle");
  el("locale").setAttribute("aria-label", t("language"));
  el("refreshBtn").setAttribute("title", t("refresh"));
  el("refreshBtn").setAttribute("aria-label", t("refresh"));

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });

  if (dashboardData) {
    renderDashboardData(dashboardData);
  }
}

function t(key, fallback = key) {
  return messages[locale]?.[key] ?? messages[DEFAULT_LOCALE]?.[key] ?? fallback;
}

function interpolate(template, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function normalizeLocale(value) {
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

function readStoredLocale() {
  try {
    return normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

function storeLocale(value) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, value);
  } catch {
    // Language switching still works when browser storage is unavailable.
  }
}

function normalizeBaseUrl(value) {
  return String(value).trim().replace(/\/+$/, "");
}

function formatDate(value) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
