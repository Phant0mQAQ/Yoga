const SUPPORTED_LOCALES = ["en", "zh-Hans", "ko"];
const DEFAULT_LOCALE = "en";
const LOCALE_STORAGE_KEY = "yomi-admin-locale";
const THEME_STORAGE_KEY = "yomi-admin-theme";

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
    darkMode: "Dark mode",
    lightMode: "Light mode",
    logout: "Logout",
    secureWorkspace: "SECURE WORKSPACE",
    signInTitle: "Sign in to Yomi Studio OS",
    signInDescription: "Manage members, classes, payments, content, and front-desk operations from one workspace.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    loginHint: "Use the administrator credentials configured for this environment.",
    editWorkspace: "EDIT WORKSPACE",
    cancel: "Cancel",
    save: "Save",
    close: "Close",
    loading: "Loading workspace...",
    requestFailed: "Request failed",
    signedOut: "You have signed out.",
    saved: "Changes saved.",
    deleted: "Item deleted.",
    created: "Item created.",
    confirmDelete: "Delete this item? This action is recorded in the audit log.",
    confirmRefund: "Refund this payment? This action cannot be undone.",
    confirmFreeze: "Freeze this membership card?",
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
    active: "Active",
    frozen: "Frozen",
    refunded: "Refunded",
    membersOps: "MEMBER OPERATIONS",
    membersTitle: "Members and membership cards",
    membersSubtitle: "Search profiles, update contact details, and manage card status.",
    scheduleOps: "PROGRAMMING",
    scheduleTitle: "Coaches, courses, and sessions",
    scheduleSubtitle: "Build the teaching schedule and manage class capacity.",
    contentOps: "CONTENT STUDIO",
    contentTitle: "Home and editorial content",
    contentSubtitle: "Manage banners, feature blocks, and yoga knowledge in three languages.",
    commerceOps: "COMMERCE",
    commerceTitle: "Products, orders, and payments",
    commerceSubtitle: "Manage inventory, review orders, and issue Stripe refunds.",
    settingsOps: "SYSTEM",
    settingsTitle: "Plans, payments, uploads, and audit",
    settingsSubtitle: "Configure membership products and review administrative activity.",
    searchMembers: "Search members",
    noResults: "No matching records.",
    edit: "Edit",
    create: "Create",
    delete: "Delete",
    freeze: "Freeze",
    extend: "Extend",
    transfer: "Transfer",
    upgrade: "Upgrade",
    refund: "Refund",
    credits: "credits",
    expires: "Expires",
    contact: "Contact",
    locale: "Language",
    roles: "Roles",
    coaches: "Coaches",
    courseSessions: "Course sessions",
    contentBlocks: "Content blocks",
    products: "Products",
    orders: "Orders",
    membershipPlans: "Membership plans",
    uploads: "Media upload",
    createUploadUrl: "Create upload URL",
    uploadReady: "Upload URL created.",
    orderTotal: "Order total",
    stock: "Stock",
    price: "Price",
    capacity: "Capacity",
    duration: "Duration",
    title: "Title",
    description: "Description",
    name: "Name",
    phone: "Phone",
    userId: "User ID",
    category: "Category",
    categoryId: "Category ID",
    age: "Age",
    experience: "Years of experience",
    avatarUrl: "Avatar URL",
    tags: "Tags",
    courseId: "Course ID",
    coachId: "Coach ID",
    startsAt: "Starts at",
    endsAt: "Ends at",
    currency: "Currency",
    priceAmount: "Price in minor units",
    deductCount: "Card credits per booking",
    type: "Type",
    target: "Target",
    sortOrder: "Sort order",
    enabled: "Enabled",
    totalCredits: "Total credits",
    validityDays: "Validity days",
    benefits: "Benefits",
    days: "Days",
    addCredits: "Credits to add",
    recipient: "Recipient",
    fileName: "File name",
    scope: "Upload scope",
    actions: "Actions",
    details: "Details",
    noData: "No data in this module yet."
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
    darkMode: "深色模式",
    lightMode: "浅色模式",
    logout: "退出账号",
    secureWorkspace: "安全工作区",
    signInTitle: "登录 Yomi Studio OS",
    signInDescription: "在一个工作区管理会员、课程、支付、内容和前台运营。",
    email: "邮箱",
    password: "密码",
    signIn: "登录",
    loginHint: "请使用为当前环境配置的管理员账号。",
    editWorkspace: "编辑工作区",
    cancel: "取消",
    save: "保存",
    close: "关闭",
    loading: "正在加载工作区...",
    requestFailed: "请求失败",
    signedOut: "账号已退出。",
    saved: "修改已保存。",
    deleted: "项目已删除。",
    created: "项目已创建。",
    confirmDelete: "确定删除此项目吗？该操作会写入审计日志。",
    confirmRefund: "确定退款吗？该操作无法撤销。",
    confirmFreeze: "确定冻结此会员卡吗？",
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
    active: "正常",
    frozen: "已冻结",
    refunded: "已退款",
    membersOps: "会员运营",
    membersTitle: "会员与会员卡",
    membersSubtitle: "搜索会员、更新联系资料并管理会员卡状态。",
    scheduleOps: "课程编排",
    scheduleTitle: "教练、课程与排课",
    scheduleSubtitle: "建立授课计划并管理课程容量。",
    contentOps: "内容中心",
    contentTitle: "首页与知识内容",
    contentSubtitle: "管理 Banner、功能推荐和中英韩瑜伽知识。",
    commerceOps: "商城运营",
    commerceTitle: "商品、订单与支付",
    commerceSubtitle: "管理库存、查看订单并处理 Stripe 退款。",
    settingsOps: "系统设置",
    settingsTitle: "会员计划、支付、上传与审计",
    settingsSubtitle: "配置会员产品并查看后台操作记录。",
    searchMembers: "搜索会员",
    noResults: "没有匹配的记录。",
    edit: "编辑",
    create: "新建",
    delete: "删除",
    freeze: "冻结",
    extend: "延期",
    transfer: "转增",
    upgrade: "升级",
    refund: "退款",
    credits: "课次",
    expires: "到期",
    contact: "联系方式",
    locale: "语言",
    roles: "角色",
    coaches: "教练",
    courseSessions: "排课",
    contentBlocks: "内容区块",
    products: "商品",
    orders: "订单",
    membershipPlans: "会员计划",
    uploads: "媒体上传",
    createUploadUrl: "创建上传地址",
    uploadReady: "上传地址已创建。",
    orderTotal: "订单金额",
    stock: "库存",
    price: "价格",
    capacity: "容量",
    duration: "时长",
    title: "标题",
    description: "描述",
    name: "姓名",
    phone: "手机号",
    userId: "用户 ID",
    category: "分类",
    categoryId: "分类 ID",
    age: "年龄",
    experience: "教龄",
    avatarUrl: "头像地址",
    tags: "标签",
    courseId: "课程 ID",
    coachId: "教练 ID",
    startsAt: "开始时间",
    endsAt: "结束时间",
    currency: "货币",
    priceAmount: "最小货币单位价格",
    deductCount: "预约扣减课次",
    type: "类型",
    target: "跳转目标",
    sortOrder: "排序",
    enabled: "启用",
    totalCredits: "总课次",
    validityDays: "有效天数",
    benefits: "会员权益",
    days: "天数",
    addCredits: "增加课次",
    recipient: "接收会员",
    fileName: "文件名",
    scope: "上传目录",
    actions: "操作",
    details: "详情",
    noData: "该模块暂无数据。"
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
    darkMode: "다크 모드",
    lightMode: "라이트 모드",
    logout: "로그아웃",
    secureWorkspace: "보안 작업 공간",
    signInTitle: "Yomi Studio OS 로그인",
    signInDescription: "회원, 수업, 결제, 콘텐츠 및 프런트 운영을 한곳에서 관리하세요.",
    email: "이메일",
    password: "비밀번호",
    signIn: "로그인",
    loginHint: "이 환경에 설정된 관리자 계정을 사용하세요.",
    editWorkspace: "작업 공간 편집",
    cancel: "취소",
    save: "저장",
    close: "닫기",
    loading: "작업 공간을 불러오는 중...",
    requestFailed: "요청 실패",
    signedOut: "로그아웃되었습니다.",
    saved: "변경 사항이 저장되었습니다.",
    deleted: "항목이 삭제되었습니다.",
    created: "항목이 생성되었습니다.",
    confirmDelete: "이 항목을 삭제할까요? 작업은 감사 기록에 남습니다.",
    confirmRefund: "이 결제를 환불할까요? 취소할 수 없습니다.",
    confirmFreeze: "이 회원권을 정지할까요?",
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
    active: "활성",
    frozen: "정지",
    refunded: "환불됨",
    membersOps: "회원 운영",
    membersTitle: "회원 및 회원권",
    membersSubtitle: "회원을 검색하고 연락처와 회원권 상태를 관리합니다.",
    scheduleOps: "프로그램",
    scheduleTitle: "강사, 수업 및 일정",
    scheduleSubtitle: "수업 일정을 만들고 정원을 관리합니다.",
    contentOps: "콘텐츠 스튜디오",
    contentTitle: "홈 및 에디토리얼 콘텐츠",
    contentSubtitle: "배너, 추천 영역 및 다국어 요가 지식을 관리합니다.",
    commerceOps: "커머스",
    commerceTitle: "상품, 주문 및 결제",
    commerceSubtitle: "재고와 주문을 관리하고 Stripe 환불을 처리합니다.",
    settingsOps: "시스템",
    settingsTitle: "회원 플랜, 결제, 업로드 및 감사",
    settingsSubtitle: "회원 상품을 설정하고 관리자 작업을 검토합니다.",
    searchMembers: "회원 검색",
    noResults: "일치하는 기록이 없습니다.",
    edit: "편집",
    create: "생성",
    delete: "삭제",
    freeze: "정지",
    extend: "연장",
    transfer: "양도",
    upgrade: "업그레이드",
    refund: "환불",
    credits: "횟수",
    expires: "만료",
    contact: "연락처",
    locale: "언어",
    roles: "역할",
    coaches: "강사",
    courseSessions: "수업 일정",
    contentBlocks: "콘텐츠 블록",
    products: "상품",
    orders: "주문",
    membershipPlans: "회원 플랜",
    uploads: "미디어 업로드",
    createUploadUrl: "업로드 URL 생성",
    uploadReady: "업로드 URL이 생성되었습니다.",
    orderTotal: "주문 금액",
    stock: "재고",
    price: "가격",
    capacity: "정원",
    duration: "시간",
    title: "제목",
    description: "설명",
    name: "이름",
    phone: "전화번호",
    userId: "사용자 ID",
    category: "카테고리",
    categoryId: "카테고리 ID",
    age: "나이",
    experience: "경력",
    avatarUrl: "프로필 이미지 URL",
    tags: "태그",
    courseId: "수업 ID",
    coachId: "강사 ID",
    startsAt: "시작 시간",
    endsAt: "종료 시간",
    currency: "통화",
    priceAmount: "최소 통화 단위 가격",
    deductCount: "예약 차감 횟수",
    type: "유형",
    target: "이동 대상",
    sortOrder: "정렬 순서",
    enabled: "사용",
    totalCredits: "총 횟수",
    validityDays: "유효 일수",
    benefits: "혜택",
    days: "일수",
    addCredits: "추가 횟수",
    recipient: "받는 회원",
    fileName: "파일 이름",
    scope: "업로드 경로",
    actions: "작업",
    details: "상세",
    noData: "이 모듈에 데이터가 없습니다."
  }
};

const viewMeta = {
  overview: ["studioOperations", "greeting", "subtitle"],
  members: ["membersOps", "membersTitle", "membersSubtitle"],
  schedule: ["scheduleOps", "scheduleTitle", "scheduleSubtitle"],
  content: ["contentOps", "contentTitle", "contentSubtitle"],
  commerce: ["commerceOps", "commerceTitle", "commerceSubtitle"],
  settings: ["settingsOps", "settingsTitle", "settingsSubtitle"]
};

const resourceSchemas = {
  coaches: [
    field("name", "name", "text", true),
    field("userId", "userId"),
    field("age", "age", "number"),
    field("yearsOfExperience", "experience", "number"),
    field("avatarUrl", "avatarUrl"),
    localizedField("bio", "description"),
    field("tags", "tags", "array")
  ],
  courses: [
    localizedField("title", "title", true),
    localizedField("description", "description"),
    field("categoryId", "categoryId"),
    field("durationMinutes", "duration", "number"),
    field("priceAmount", "priceAmount", "number"),
    field("currency", "currency", "select", true, ["KRW", "HKD", "USD", "CNY"]),
    field("capacity", "capacity", "number"),
    field("memberCardDeductCount", "deductCount", "number"),
    field("tags", "tags", "array")
  ],
  "course-sessions": [
    field("courseId", "courseId", "text", true),
    field("coachId", "coachId", "text", true),
    field("startsAt", "startsAt", "datetime-local", true),
    field("endsAt", "endsAt", "datetime-local", true),
    field("capacity", "capacity", "number", true),
    field("status", "status", "select", true, ["open", "cancelled"])
  ],
  "content-blocks": [
    field("type", "type", "select", true, ["banner", "feature", "knowledge", "recommendation"]),
    localizedField("title", "title", true),
    localizedField("description", "description"),
    field("target", "target"),
    field("sortOrder", "sortOrder", "number"),
    field("active", "enabled", "checkbox")
  ],
  products: [
    localizedField("title", "title", true),
    localizedField("description", "description"),
    field("category", "category"),
    field("priceAmount", "priceAmount", "number", true),
    field("currency", "currency", "select", true, ["KRW", "HKD", "USD", "CNY"]),
    field("stock", "stock", "number"),
    field("active", "enabled", "checkbox")
  ],
  "membership-plans": [
    localizedField("title", "title", true),
    field("totalCredits", "totalCredits", "number", true),
    field("priceAmount", "priceAmount", "number", true),
    field("currency", "currency", "select", true, ["KRW", "HKD", "USD", "CNY"]),
    field("validityDays", "validityDays", "number", true),
    field("benefits", "benefits", "array")
  ]
};

let token = "";
let locale = readStoredValue(LOCALE_STORAGE_KEY, DEFAULT_LOCALE);
let theme = readStoredValue(THEME_STORAGE_KEY, "light");
let activeView = "overview";
let activeResource = { schedule: "courses", commerce: "products" };
let currentData = {};
let modalSubmit = null;
let toastTimer = null;
const API_BASE_URL = normalizeBaseUrl(window.YOMI_CONFIG?.apiBaseUrl ?? "");
const el = (id) => document.getElementById(id);

applyTheme();
el("locale").value = normalizeLocale(locale);
locale = normalizeLocale(locale);
applyTranslations();

el("locale").addEventListener("change", async (event) => {
  locale = normalizeLocale(event.target.value);
  storeValue(LOCALE_STORAGE_KEY, locale);
  applyTranslations();
  if (token) await loadView();
});
el("themeBtn").addEventListener("click", toggleTheme);
el("loginBtn").addEventListener("click", login);
el("password").addEventListener("keydown", (event) => {
  if (event.key === "Enter") void login();
});
el("logoutBtn").addEventListener("click", logout);
el("refreshBtn").addEventListener("click", () => void loadView());
el("modalCloseBtn").addEventListener("click", closeModal);
el("modalCancelBtn").addEventListener("click", closeModal);
el("modalBackdrop").addEventListener("click", (event) => {
  if (event.target === el("modalBackdrop")) closeModal();
});
el("modalForm").addEventListener("submit", submitModal);

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!token || button.dataset.view === activeView) return;
    activeView = button.dataset.view;
    updateNavigation();
    void loadView();
  });
});

el("viewRoot").addEventListener("click", handleViewClick);
el("viewRoot").addEventListener("input", handleViewInput);

async function login() {
  setLoginMessage(t("loading"));
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
    setAuthenticated(true);
    activeView = "overview";
    updateNavigation();
    await loadView();
  } catch (error) {
    setLoginMessage(error.message);
  }
}

async function logout() {
  const previousToken = token;
  token = "";
  try {
    if (previousToken) {
      token = previousToken;
      await api("/auth/logout", { method: "POST", suppressAuthReset: true });
    }
  } catch {
    // Local logout must still complete if the network is unavailable.
  } finally {
    token = "";
    currentData = {};
    closeModal();
    setAuthenticated(false);
    setLoginMessage(t("signedOut"));
    el("password").value = "";
  }
}

function setAuthenticated(authenticated) {
  el("loginPanel").hidden = authenticated;
  el("viewRoot").hidden = !authenticated;
  el("refreshBtn").hidden = !authenticated;
  el("logoutBtn").hidden = !authenticated;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.disabled = !authenticated;
  });
  if (!authenticated) {
    activeView = "overview";
    updateNavigation();
    applyHeader();
    el("viewRoot").innerHTML = "";
  }
}

async function loadView() {
  if (!token) return;
  applyHeader();
  el("viewRoot").innerHTML = `<div class="loading-state"><span class="spinner"></span>${escapeHtml(t("loading"))}</div>`;
  try {
    if (activeView === "overview") await renderOverview();
    if (activeView === "members") await renderMembers();
    if (activeView === "schedule") await renderResourceWorkspace("schedule");
    if (activeView === "content") await renderContent();
    if (activeView === "commerce") await renderResourceWorkspace("commerce");
    if (activeView === "settings") await renderSettings();
  } catch (error) {
    if (error.status === 401) {
      token = "";
      setAuthenticated(false);
      setLoginMessage(error.message);
      return;
    }
    el("viewRoot").innerHTML = renderError(error.message);
  }
}

async function renderOverview() {
  const [dashboard, bookings, cards, payments, availability, auditLogs, methods] = await Promise.all([
    api("/admin/dashboard"),
    api(`/bookings?locale=${encodeURIComponent(locale)}`),
    api("/admin/member-cards"),
    api("/admin/payments"),
    api(`/availability?locale=${encodeURIComponent(locale)}`),
    api("/admin/audit-logs"),
    api(`/payments/methods?country=HK&currency=HKD&locale=${encodeURIComponent(locale)}`)
  ]);
  currentData = { dashboard, bookings, cards, payments, availability, auditLogs, methods };
  el("viewRoot").innerHTML = `
    <section class="summary-grid">
      ${metric("01", availability.length, t("courses"))}
      ${metric("02", bookings.length, t("bookings"))}
      ${metric("03", cards.length, t("memberCards"))}
      ${metric("04", payments.length, t("payments"))}
    </section>
    <section class="content-grid">
      <article class="panel">
        ${sectionHead("today", "classAvailability", `<button class="secondary" data-action="demo-booking">${escapeHtml(t("createDemoBooking"))}</button>`)}
        <div class="table-wrap"><table>
          <thead><tr><th>${t("course")}</th><th>${t("coach")}</th><th>${t("start")}</th><th>${t("open")}</th></tr></thead>
          <tbody>${availability.map((item) => `<tr><td>${escapeHtml(localized(item.course?.title) || item.courseId)}</td><td>${escapeHtml(item.coach?.name || item.coachId)}</td><td>${formatDate(item.startsAt)}</td><td>${item.remainingCapacity}</td></tr>`).join("")}</tbody>
        </table></div>
      </article>
      <article class="panel">
        ${sectionHead("frontDesk", "recentBookings")}
        <div class="table-wrap"><table>
          <thead><tr><th>${t("member")}</th><th>${t("course")}</th><th>${t("status")}</th><th></th></tr></thead>
          <tbody>${bookings.length ? bookings.map(bookingRow).join("") : emptyRow(4, "noBookings")}</tbody>
        </table></div>
      </article>
    </section>
    <section class="panel">
      ${sectionHeadRaw("STRIPE", t("paymentMethods"))}
      <div class="method-list">${methods.map(paymentMethodCard).join("")}</div>
    </section>
    <section class="panel">
      ${sectionHead("security", "auditHistory", `<span class="readonly">${escapeHtml(t("readOnly"))}</span>`)}
      ${auditTable(auditLogs.slice(-12).reverse())}
    </section>`;
}

async function renderMembers() {
  const [members, cards] = await Promise.all([api("/admin/members"), api("/admin/member-cards")]);
  currentData = { members, cards };
  el("viewRoot").innerHTML = `
    <section class="module-toolbar">
      <label class="search-field"><span class="visually-hidden">${t("searchMembers")}</span><input id="memberSearch" type="search" placeholder="${escapeAttr(t("searchMembers"))}"></label>
      <span class="count-badge">${members.length} ${escapeHtml(t("members"))}</span>
    </section>
    <section id="memberList" class="resource-list">${renderMemberCards(members, cards)}</section>`;
}

function renderMemberCards(members, cards, query = "") {
  const normalized = query.trim().toLowerCase();
  const filtered = members.filter((member) =>
    `${member.name} ${member.email || ""} ${member.phone || ""}`.toLowerCase().includes(normalized)
  );
  if (!filtered.length) return emptyState("noResults");
  return filtered.map((member) => {
    const memberCards = cards.filter((card) => card.userId === member.id);
    return `<article class="resource-card">
      <div class="resource-card-main">
        <div class="avatar">${escapeHtml(initials(member.name))}</div>
        <div class="resource-copy">
          <div class="resource-title-row"><h2>${escapeHtml(member.name)}</h2>${statusBadge(member.locale)}</div>
          <p>${escapeHtml(member.email || member.phone || t("noData"))}</p>
          <div class="resource-meta"><span>${member.bookings?.length || 0} ${t("bookings")}</span><span>${member.orders?.length || 0} ${t("orders")}</span><span>${memberCards.length} ${t("memberCards")}</span></div>
        </div>
        <button class="secondary compact" data-action="edit-member" data-id="${escapeAttr(member.id)}">${t("edit")}</button>
      </div>
      ${memberCards.map((card) => `<div class="card-strip">
        <div><strong>${escapeHtml(card.id)}</strong><span>${card.remainingCredits}/${card.totalCredits} ${t("credits")} · ${t("expires")} ${formatDate(card.expiresAt, false)}</span></div>
        ${statusBadge(card.status)}
        <div class="inline-actions">
          <button class="secondary compact" data-action="freeze-card" data-id="${escapeAttr(card.id)}">${t("freeze")}</button>
          <button class="secondary compact" data-action="extend-card" data-id="${escapeAttr(card.id)}">${t("extend")}</button>
          <button class="secondary compact" data-action="upgrade-card" data-id="${escapeAttr(card.id)}">${t("upgrade")}</button>
          <button class="secondary compact" data-action="transfer-card" data-id="${escapeAttr(card.id)}">${t("transfer")}</button>
        </div>
      </div>`).join("")}
    </article>`;
  }).join("");
}

async function renderResourceWorkspace(workspace) {
  const resources = workspace === "schedule"
    ? ["coaches", "courses", "course-sessions"]
    : ["products", "orders", "payments"];
  const resource = activeResource[workspace];
  const rows = await api(`/admin/${resource}`);
  currentData = { resource, rows };
  el("viewRoot").innerHTML = `
    ${resourceTabs(resources, resource)}
    <section class="module-toolbar">
      <span class="count-badge">${rows.length} ${escapeHtml(resourceLabel(resource))}</span>
      ${editableResource(resource) ? `<button data-action="create-resource" data-resource="${resource}">+ ${t("create")} ${escapeHtml(resourceLabel(resource))}</button>` : ""}
    </section>
    <section class="resource-list">${renderResourceRows(resource, rows)}</section>`;
}

async function renderContent() {
  const rows = await api("/admin/content-blocks");
  currentData = { resource: "content-blocks", rows };
  el("viewRoot").innerHTML = `
    <section class="module-toolbar">
      <span class="count-badge">${rows.length} ${t("contentBlocks")}</span>
      <button data-action="create-resource" data-resource="content-blocks">+ ${t("create")} ${t("contentBlocks")}</button>
    </section>
    <section class="resource-list content-cards">${renderResourceRows("content-blocks", rows)}</section>`;
}

async function renderSettings() {
  const [plans, methods, auditLogs] = await Promise.all([
    api("/admin/membership-plans"),
    api(`/payments/methods?country=KR&currency=KRW&locale=${encodeURIComponent(locale)}`),
    api("/admin/audit-logs")
  ]);
  currentData = { resource: "membership-plans", rows: plans, methods, auditLogs };
  el("viewRoot").innerHTML = `
    <section class="settings-grid">
      <article class="panel">
        ${sectionHeadRaw(t("membershipPlans"), `${plans.length}`, `<button class="secondary compact" data-action="create-resource" data-resource="membership-plans">+ ${t("create")}</button>`)}
        <div class="resource-list compact-list">${renderResourceRows("membership-plans", plans)}</div>
      </article>
      <article class="panel">
        ${sectionHeadRaw("STRIPE", t("paymentMethods"))}
        <div class="method-list">${methods.map(paymentMethodCard).join("")}</div>
      </article>
      <article class="panel">
        ${sectionHeadRaw(t("uploads"), t("createUploadUrl"))}
        <div class="upload-zone"><span>↑</span><p>${t("createUploadUrl")}</p><button data-action="create-upload">${t("createUploadUrl")}</button></div>
      </article>
      <article class="panel audit-wide">
        ${sectionHead("security", "auditHistory", `<span class="readonly">${t("readOnly")}</span>`)}
        ${auditTable(auditLogs.slice(-30).reverse())}
      </article>
    </section>`;
}

function renderResourceRows(resource, rows) {
  if (!rows.length) return emptyState("noData");
  if (resource === "orders") return rows.map(orderCard).join("");
  if (resource === "payments") return rows.map(paymentCard).join("");
  return rows.map((item) => resourceCard(resource, item)).join("");
}

function resourceCard(resource, item) {
  const title = resourceTitle(resource, item);
  const details = resourceDetails(resource, item);
  return `<article class="resource-card">
    <div class="resource-card-main">
      <div class="resource-icon">${resourceIcon(resource)}</div>
      <div class="resource-copy">
        <div class="resource-title-row"><h2>${escapeHtml(title)}</h2>${statusBadge(item.status || (item.active === false ? "disabled" : "active"))}</div>
        <p>${escapeHtml(details)}</p>
        <div class="resource-meta"><span>${escapeHtml(item.id)}</span></div>
      </div>
      <div class="inline-actions">
        <button class="secondary compact" data-action="edit-resource" data-resource="${resource}" data-id="${escapeAttr(item.id)}">${t("edit")}</button>
        <button class="danger compact" data-action="delete-resource" data-resource="${resource}" data-id="${escapeAttr(item.id)}">${t("delete")}</button>
      </div>
    </div>
  </article>`;
}

function orderCard(order) {
  return `<article class="resource-card"><div class="resource-card-main">
    <div class="resource-icon">#</div><div class="resource-copy">
      <div class="resource-title-row"><h2>${escapeHtml(order.id)}</h2>${statusBadge(order.status)}</div>
      <p>${t("orderTotal")}: ${formatAmount(order.totalAmount, order.currency)}</p>
      <div class="resource-meta"><span>${escapeHtml(order.userId)}</span><span>${formatDate(order.createdAt)}</span></div>
    </div>
  </div></article>`;
}

function paymentCard(payment) {
  return `<article class="resource-card"><div class="resource-card-main">
    <div class="resource-icon">$</div><div class="resource-copy">
      <div class="resource-title-row"><h2>${escapeHtml(payment.paymentMethodCode || payment.id)}</h2>${statusBadge(payment.refundStatus === "refunded" ? "refunded" : payment.status)}</div>
      <p>${formatAmount(payment.amount, payment.currency)} · ${escapeHtml(payment.country || "")}</p>
      <div class="resource-meta"><span>${escapeHtml(payment.id)}</span><span>${escapeHtml(payment.paymentProvider || "stripe")}</span></div>
    </div>
    ${payment.refundStatus !== "refunded" ? `<button class="danger compact" data-action="refund-payment" data-id="${escapeAttr(payment.id)}">${t("refund")}</button>` : ""}
  </div></article>`;
}

async function handleViewClick(event) {
  const button = event.target.closest("button[data-action], button[data-resource-tab]");
  if (!button) return;
  const action = button.dataset.action;

  if (button.dataset.resourceTab) {
    activeResource[activeView] = button.dataset.resourceTab;
    await loadView();
    return;
  }
  if (action === "retry") return loadView();
  if (action === "demo-booking") return runAction(createDemoBooking, t("created"));
  if (action === "check-in") return runAction(() => adminWrite(`/bookings/${button.dataset.id}/check-in`, "POST", { method: "manual" }), t("saved"));
  if (action === "edit-member") return openMemberForm(button.dataset.id);
  if (action === "freeze-card") return freezeCard(button.dataset.id);
  if (action === "extend-card") return openCardOperation(button.dataset.id, "extend");
  if (action === "upgrade-card") return openCardOperation(button.dataset.id, "upgrade");
  if (action === "transfer-card") return openCardOperation(button.dataset.id, "transfer");
  if (action === "create-resource") return openResourceForm(button.dataset.resource);
  if (action === "edit-resource") return openResourceForm(button.dataset.resource, button.dataset.id);
  if (action === "delete-resource") return deleteResource(button.dataset.resource, button.dataset.id);
  if (action === "refund-payment") return refundPayment(button.dataset.id);
  if (action === "create-upload") return openUploadForm();
}

function handleViewInput(event) {
  if (event.target.id !== "memberSearch") return;
  el("memberList").innerHTML = renderMemberCards(currentData.members, currentData.cards, event.target.value);
}

function openMemberForm(id) {
  const member = currentData.members.find((item) => item.id === id);
  if (!member) return;
  openForm({
    title: `${t("edit")} ${member.name}`,
    fields: [
      field("name", "name", "text", true),
      field("email", "email", "email", true),
      field("phone", "phone"),
      field("locale", "locale", "select", true, SUPPORTED_LOCALES),
      field("roles", "roles", "array")
    ],
    initial: member,
    submit: async (body) => {
      await adminWrite(`/admin/members/${encodeURIComponent(id)}`, "PATCH", body);
    }
  });
}

function openResourceForm(resource, id = null) {
  const schema = resourceSchemas[resource];
  if (!schema) return;
  const initial = id ? currentData.rows.find((item) => item.id === id) || {} : defaultResource(resource);
  openForm({
    title: `${id ? t("edit") : t("create")} ${resourceLabel(resource)}`,
    fields: schema,
    initial,
    submit: async (body) => {
      if (id) {
        await adminWrite(`/admin/${resource}/${encodeURIComponent(id)}`, "PATCH", body);
      } else {
        await adminWrite(`/admin/${resource}`, "POST", body);
      }
    }
  });
}

function openCardOperation(id, operation) {
  if (operation === "extend") {
    openForm({
      title: t("extend"),
      fields: [field("days", "days", "number", true)],
      initial: { days: 30 },
      submit: (body) => adminWrite(`/admin/member-cards/${encodeURIComponent(id)}/extend`, "POST", body)
    });
  }
  if (operation === "upgrade") {
    openForm({
      title: t("upgrade"),
      fields: [field("addCredits", "addCredits", "number", true)],
      initial: { addCredits: 2 },
      submit: (body) => adminWrite(`/admin/member-cards/${encodeURIComponent(id)}/upgrade`, "POST", body)
    });
  }
  if (operation === "transfer") {
    const options = currentData.members.map((member) => ({ value: member.id, label: member.name }));
    openForm({
      title: t("transfer"),
      fields: [field("toUserId", "recipient", "select", true, options)],
      initial: {},
      submit: (body) => adminWrite(`/admin/member-cards/${encodeURIComponent(id)}/transfer`, "POST", body)
    });
  }
}

async function freezeCard(id) {
  if (!window.confirm(t("confirmFreeze"))) return;
  await runAction(() => adminWrite(`/admin/member-cards/${encodeURIComponent(id)}/freeze`, "POST", {}), t("saved"));
}

async function deleteResource(resource, id) {
  if (!window.confirm(t("confirmDelete"))) return;
  await runAction(() => adminWrite(`/admin/${resource}/${encodeURIComponent(id)}`, "DELETE", {}), t("deleted"));
}

async function refundPayment(id) {
  if (!window.confirm(t("confirmRefund"))) return;
  await runAction(() => adminWrite(`/admin/payments/${encodeURIComponent(id)}/refunds`, "POST", { reason: "web_admin" }), t("saved"));
}

function openUploadForm() {
  openForm({
    title: t("createUploadUrl"),
    fields: [field("fileName", "fileName", "text", true), field("scope", "scope", "text", true)],
    initial: { fileName: "image.jpg", scope: "content" },
    submit: async (body) => {
      const result = await adminWrite("/admin/uploads/presign", "POST", body);
      showToast(`${t("uploadReady")} ${result.uploadUrl}`);
    }
  });
}

function openForm({ title, fields, initial, submit }) {
  modalSubmit = submit;
  el("modalTitle").textContent = title;
  el("modalError").hidden = true;
  el("modalFields").innerHTML = fields.flatMap((definition) => {
    if (!definition.localized) return [renderField(definition, getPath(initial, definition.key))];
    return SUPPORTED_LOCALES.map((language) => renderField(
      { ...definition, key: `${definition.key}.${language}`, labelText: `${t(definition.label)} · ${language}`, localized: false },
      getPath(initial, `${definition.key}.${language}`)
    ));
  }).join("");
  el("modalBackdrop").hidden = false;
  document.body.classList.add("modal-open");
  el("modalFields").querySelector("input, select, textarea")?.focus();
}

function closeModal() {
  modalSubmit = null;
  el("modalBackdrop").hidden = true;
  document.body.classList.remove("modal-open");
  el("modalForm").reset();
}

async function submitModal(event) {
  event.preventDefault();
  if (!modalSubmit) return;
  const submitButton = el("modalSaveBtn");
  submitButton.disabled = true;
  el("modalError").hidden = true;
  try {
    const body = readForm(el("modalForm"));
    await modalSubmit(body);
    closeModal();
    showToast(t("saved"));
    await loadView();
  } catch (error) {
    el("modalError").textContent = error.message;
    el("modalError").hidden = false;
  } finally {
    submitButton.disabled = false;
  }
}

function readForm(form) {
  const output = {};
  form.querySelectorAll("[data-field-key]").forEach((input) => {
    const key = input.dataset.fieldKey;
    const type = input.dataset.valueType;
    let value;
    if (type === "checkbox") value = input.checked;
    else if (type === "number") value = input.value === "" ? 0 : Number(input.value);
    else if (type === "array") value = input.value.split(",").map((item) => item.trim()).filter(Boolean);
    else if (type === "datetime-local") value = input.value ? new Date(input.value).toISOString() : "";
    else value = input.value.trim();
    setPath(output, key, value);
  });
  return output;
}

function renderField(definition, value) {
  const label = definition.labelText || t(definition.label);
  const required = definition.required ? "required" : "";
  const common = `data-field-key="${escapeAttr(definition.key)}" data-value-type="${escapeAttr(definition.type)}" ${required}`;
  if (definition.type === "checkbox") {
    return `<label class="checkbox-field"><input type="checkbox" ${common} ${value !== false ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`;
  }
  if (definition.type === "select") {
    const options = (definition.options || []).map((option) => {
      const normalized = typeof option === "string" ? { value: option, label: option } : option;
      return `<option value="${escapeAttr(normalized.value)}" ${String(value ?? "") === String(normalized.value) ? "selected" : ""}>${escapeHtml(normalized.label)}</option>`;
    }).join("");
    return `<label><span>${escapeHtml(label)}</span><select ${common}><option value=""></option>${options}</select></label>`;
  }
  const inputType = ["number", "email", "datetime-local"].includes(definition.type) ? definition.type : "text";
  const displayValue = definition.type === "datetime-local" ? toDateTimeLocal(value) : definition.type === "array" && Array.isArray(value) ? value.map(localized).join(", ") : value ?? "";
  return `<label><span>${escapeHtml(label)}</span><input type="${inputType}" value="${escapeAttr(displayValue)}" ${common}></label>`;
}

async function runAction(action, successMessage) {
  try {
    await action();
    if (successMessage) showToast(successMessage);
    await loadView();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function createDemoBooking() {
  const availability = currentData.availability || await api(`/availability?locale=${encodeURIComponent(locale)}`);
  const first = availability[0];
  if (!first) return;
  const adminToken = token;
  try {
    const studentLogin = await api("/auth/login", {
      method: "POST",
      body: { email: "student@example.com", password: "Yomi@2026", role: "student", locale }
    });
    token = studentLogin.token;
    await adminWrite("/bookings", "POST", { courseSessionId: first.id, paymentMode: "member_card" });
  } finally {
    token = adminToken;
  }
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw apiError(t("requestFailed"), 0);
  }
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!response.ok) throw apiError(data.message || data.error || t("requestFailed"), response.status);
  return data;
}

function adminWrite(path, method, body) {
  return api(path, {
    method,
    body,
    idempotencyKey: `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
  });
}

function applyTranslations() {
  document.documentElement.lang = locale;
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });
  el("locale").setAttribute("aria-label", t("language"));
  el("refreshBtn").title = t("refresh");
  el("refreshBtn").setAttribute("aria-label", t("refresh"));
  el("modalCloseBtn").setAttribute("aria-label", t("close"));
  applyTheme();
  applyHeader();
}

function applyHeader() {
  const [eyebrow, title, subtitle] = viewMeta[token ? activeView : "overview"];
  el("pageEyebrow").textContent = t(eyebrow);
  el("pageTitle").textContent = t(title);
  el("pageSubtitle").textContent = t(subtitle);
}

function toggleTheme() {
  theme = theme === "dark" ? "light" : "dark";
  storeValue(THEME_STORAGE_KEY, theme);
  applyTheme();
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark";
  el("themeBtn").textContent = dark ? "☀" : "☾";
  el("themeBtn").title = t(dark ? "lightMode" : "darkMode");
  el("themeBtn").setAttribute("aria-label", t(dark ? "lightMode" : "darkMode"));
  document.querySelector('meta[name="theme-color"]').content = dark ? "#111613" : "#f7f6f2";
}

function updateNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
}

function showToast(message, error = false) {
  clearTimeout(toastTimer);
  el("toast").textContent = message;
  el("toast").classList.toggle("error", error);
  el("toast").hidden = false;
  toastTimer = setTimeout(() => { el("toast").hidden = true; }, 4200);
}

function setLoginMessage(message) {
  el("loginHint").textContent = message;
}

function t(key, fallback = key) {
  return messages[locale]?.[key] ?? messages.en[key] ?? fallback;
}

function field(key, label, type = "text", required = false, options = []) {
  return { key, label, type, required, options };
}

function localizedField(key, label, required = false) {
  return { key, label, type: "text", required, localized: true };
}

function defaultResource(resource) {
  if (resource === "courses") return { currency: "KRW", durationMinutes: 60, priceAmount: 0, capacity: 8, memberCardDeductCount: 1 };
  if (resource === "course-sessions") return { capacity: 8, status: "open" };
  if (resource === "content-blocks") return { type: "banner", sortOrder: 1, active: true };
  if (resource === "products") return { currency: "KRW", priceAmount: 0, stock: 0, active: true };
  if (resource === "membership-plans") return { currency: "KRW", totalCredits: 10, priceAmount: 0, validityDays: 180 };
  return {};
}

function resourceTitle(resource, item) {
  if (resource === "coaches") return item.name || item.id;
  if (resource === "course-sessions") return `${item.courseId} · ${formatDate(item.startsAt)}`;
  return localized(item.title) || item.name || item.id;
}

function resourceDetails(resource, item) {
  if (resource === "coaches") return `${item.yearsOfExperience || 0} ${t("experience")} · ${(item.tags || []).map(localized).join(", ")}`;
  if (resource === "courses") return `${item.durationMinutes || 0} min · ${formatAmount(item.priceAmount, item.currency)} · ${item.capacity} ${t("capacity")}`;
  if (resource === "course-sessions") return `${item.coachId} · ${formatDate(item.endsAt)} · ${item.bookedCount || 0}/${item.capacity}`;
  if (resource === "content-blocks") return `${item.type} · ${localized(item.description)}`;
  if (resource === "products") return `${formatAmount(item.priceAmount, item.currency)} · ${t("stock")}: ${item.stock || 0}`;
  if (resource === "membership-plans") return `${item.totalCredits} ${t("credits")} · ${formatAmount(item.priceAmount, item.currency)} · ${item.validityDays} ${t("days")}`;
  return item.id;
}

function resourceLabel(resource) {
  const labels = {
    coaches: "coaches",
    courses: "courses",
    "course-sessions": "courseSessions",
    "content-blocks": "contentBlocks",
    products: "products",
    orders: "orders",
    payments: "payments",
    "membership-plans": "membershipPlans"
  };
  return t(labels[resource] || resource);
}

function resourceIcon(resource) {
  return ({ coaches: "C", courses: "Y", "course-sessions": "S", "content-blocks": "T", products: "P", "membership-plans": "M" })[resource] || "•";
}

function editableResource(resource) {
  return !["orders", "payments"].includes(resource);
}

function resourceTabs(resources, active) {
  return `<div class="segmented">${resources.map((resource) =>
    `<button class="${resource === active ? "active" : ""}" data-resource-tab="${resource}">${escapeHtml(resourceLabel(resource))}</button>`
  ).join("")}</div>`;
}

function metric(index, value, label) {
  return `<article><span class="metric-index">${index}</span><strong>${value}</strong><label>${escapeHtml(label)}</label></article>`;
}

function sectionHead(eyebrowKey, titleKey, action = "") {
  return sectionHeadRaw(t(eyebrowKey), t(titleKey), action);
}

function sectionHeadRaw(eyebrow, title, action = "") {
  return `<div class="section-head"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2></div>${action}</div>`;
}

function bookingRow(item) {
  return `<tr><td>${escapeHtml(item.user?.name || item.userId)}</td><td>${escapeHtml(localized(item.course?.title) || item.courseId)}</td><td>${escapeHtml(t(item.status, item.status))}</td><td>${item.status === "confirmed" ? `<button class="secondary compact" data-action="check-in" data-id="${escapeAttr(item.id)}">${t("checkIn")}</button>` : ""}</td></tr>`;
}

function paymentMethodCard(method) {
  return `<div class="method"><strong>${escapeHtml(method.display?.[locale] || method.display?.en || method.code)}</strong><span>${escapeHtml(interpolate(t("methodDetails"), method))}</span></div>`;
}

function auditTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>${t("time")}</th><th>${t("actor")}</th><th>${t("action")}</th><th>${t("entity")}</th></tr></thead><tbody>${rows.length ? rows.map((item) => `<tr><td>${formatDate(item.createdAt)}</td><td>${escapeHtml(item.actorRole)}</td><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.entityId)}</td></tr>`).join("") : emptyRow(4, "noData")}</tbody></table></div>`;
}

function statusBadge(status) {
  const value = status || "active";
  return `<span class="status-badge status-${escapeAttr(value)}">${escapeHtml(t(value, value))}</span>`;
}

function emptyRow(columns, key) {
  return `<tr><td colspan="${columns}" class="empty-cell">${escapeHtml(t(key))}</td></tr>`;
}

function emptyState(key) {
  return `<div class="empty-state"><span>—</span><p>${escapeHtml(t(key))}</p></div>`;
}

function renderError(message) {
  return `<div class="error-state"><strong>${escapeHtml(t("requestFailed"))}</strong><p>${escapeHtml(message)}</p><button data-action="retry">${escapeHtml(t("refresh"))}</button></div>`;
}

function localized(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value[locale] ?? value.en ?? value["zh-Hans"] ?? value.ko ?? "");
}

function formatDate(value, includeTime = true) {
  if (!value) return "";
  const options = includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" };
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

function formatAmount(amount = 0, currency = "USD") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount) || 0);
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function initials(value = "") {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  let cursor = object;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] ||= {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
}

function interpolate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) =>
    result.replaceAll(`{${key}}`, String(value)), template);
}

function normalizeLocale(value) {
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

function normalizeBaseUrl(value) {
  return String(value).trim().replace(/\/+$/, "");
}

function readStoredValue(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function storeValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Current-session preferences still work without browser storage.
  }
}

function apiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
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

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
