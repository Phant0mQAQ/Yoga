const THEME_STORAGE_KEY = "good-vibe-mobile-theme";
const DATA_REFRESH_INTERVAL_MS = 60_000;
let dataRefreshPromise = null;

const state = {
  token: localStorage.getItem("token") || "",
  role: localStorage.getItem("role") || "student",
  locale: localStorage.getItem("locale") || preferredLocale(),
  theme: preferredTheme(),
  paymentRegion: preferredPaymentRegion(),
  user: null,
  tab: "home",
  busy: false,
  avatarBusy: false,
  status: "",
  dataLoadFailed: false,
  pendingBookings: new Set(),
  pendingCheckIns: new Set(),
  data: { home: null, availability: [], bookings: [], cards: [], paymentMethods: [] }
};

const messages = {
  en: {
    language: "Language", darkMode: "Dark mode", lightMode: "Light mode",
    student: "Student", coach: "Coach", staff: "Staff", staffSignIn: "Studio operations",
    email: "Email", password: "Password", signIn: "Sign in",
    logout: "Sign out", home: "Discover", bookings: "Bookings", profile: "Profile", privacy: "Privacy Policy", privacyChoices: "California Privacy Choices", terms: "Membership & Booking Terms", cancelMembership: "Cancel membership", deleteAccount: "Delete account", cancelMembershipConfirm: "Submit a membership cancellation request and stop auto-renewal?", deleteAccountConfirm: "Permanently delete your account and eligible personal data?", requestSubmitted: "Request submitted.",
    changeProfilePhoto: "Change profile photo", uploadingProfilePhoto: "Uploading photo...", avatarUpdated: "Profile photo updated.", avatarTooLarge: "Profile photos must be 10 MB or smaller.", invalidAvatarType: "Choose a JPEG, PNG, WebP, HEIC, or HEIF image.",
    classes: "Upcoming classes", book: "Book", remaining: "Credits left",
    courseCatalog: "Course catalog", courseCatalogMeta: "All active studio courses", noUpcomingSession: "No upcoming session scheduled",
    studioUpdates: "Studio updates", studioUpdatesMeta: "Latest guidance and highlights", studioShop: "Studio shop", studioShopMeta: "Products currently available",
    minutes: "min", capacity: "spots", stock: "in stock",
    memberCard: "Studio Pass", paymentMethods: "Payment methods", checkIn: "Check in",
    noData: "Nothing here yet", greeting: "Good morning", joining: "joining",
    tagline: "Move well. Feel present.", intro: "A calmer way to book classes, meet your coach, and manage the studio.",
    continueAs: "Continue as", classSocialMeta: "See who is joining before you book", paymentRegion: "All supported payment options",
    demoPassword: "Demo password", weekStreak: "4 week streak", yogi: "Yogi",
    todayAtGoodVibe: "Today at Good Vibe", teachingDay: "Your teaching day.", sessions: "Sessions",
    confirmed: "Confirmed", arrived: "Arrived", frontDesk: "FRONT DESK", readyForArrivals: "Ready for arrivals",
    live: "Live", arrivalsMeta: "Scan a booking QR code or use manual check-in below.", account: "Account",
    goodVibeMembership: "GOOD VIBE MEMBERSHIP", left: "left", waitlist: "waitlist",
    active: "Active", frozen: "Frozen", transferred: "Transferred", upgraded: "Upgraded", expired: "Expired",
    checkedIn: "Checked in", cancelled: "Cancelled", pendingPayment: "Pending payment", waitlisted: "Waitlisted",
    classFull: "Class full", noEligibleCard: "No active, unexpired membership card has enough credits for this class.",
    reserving: "Reserving...", checkingIn: "Checking in...", bookingConfirmed: "Class reserved.", checkInComplete: "Check-in complete.",
    alreadyBooked: "You already have an active booking for this class.", sessionClosed: "This class is no longer open.",
    checkInNotEligible: "This booking cannot be checked in.", requestFailed: "Request failed. Please try again.", signingIn: "Signing in...",
    retry: "Retry", refresh: "Refresh", dataLoadFailed: "Some studio data could not be loaded. Your previous data was kept."
  },
  "zh-Hans": {
    language: "\u8bed\u8a00", darkMode: "\u6df1\u8272\u6a21\u5f0f", lightMode: "\u6d45\u8272\u6a21\u5f0f",
    demoPassword: "\u6f14\u793a\u5bc6\u7801", weekStreak: "\u8fde\u7eed 4 \u5468", yogi: "\u4f3d\u4eba",
    todayAtGoodVibe: "\u4eca\u65e5 Good Vibe", teachingDay: "\u4eca\u65e5\u6388\u8bfe\uff0c\u4e00\u76ee\u4e86\u7136\u3002", sessions: "\u8bfe\u6b21",
    confirmed: "\u5df2\u786e\u8ba4", arrived: "\u5df2\u5230\u5e97", frontDesk: "\u524d\u53f0", readyForArrivals: "\u51c6\u5907\u63a5\u5f85\u5230\u5e97\u5b66\u5458",
    live: "\u5b9e\u65f6", arrivalsMeta: "\u626b\u63cf\u9884\u7ea6\u4e8c\u7ef4\u7801\uff0c\u6216\u5728\u4e0b\u65b9\u624b\u52a8\u6838\u9500\u3002", account: "\u8d26\u6237",
    goodVibeMembership: "GOOD VIBE \u4f1a\u5458", left: "\u4e2a\u4f59\u4f4d", waitlist: "\u5019\u8865",
    active: "\u6709\u6548", frozen: "\u5df2\u51bb\u7ed3", transferred: "\u5df2\u8f6c\u8ba9", upgraded: "\u5df2\u5347\u7ea7", expired: "\u5df2\u8fc7\u671f",
    checkedIn: "\u5df2\u6838\u9500", cancelled: "\u5df2\u53d6\u6d88", pendingPayment: "\u5f85\u652f\u4ed8", waitlisted: "\u5df2\u5019\u8865",
    student: "学员", coach: "教练", staff: "员工", staffSignIn: "场馆运营",
    email: "邮箱", password: "密码", signIn: "登录",
    logout: "退出登录", home: "发现", bookings: "预约", profile: "我的", privacy: "隐私政策", privacyChoices: "加州隐私选择", terms: "会员与预约条款", cancelMembership: "取消会员", deleteAccount: "删除账户", cancelMembershipConfirm: "提交会员取消申请并停止自动续费？", deleteAccountConfirm: "永久删除账户及可删除的个人数据？", requestSubmitted: "申请已提交。",
    changeProfilePhoto: "更换头像", uploadingProfilePhoto: "正在上传头像…", avatarUpdated: "头像已更新。", avatarTooLarge: "头像图片不能超过 10 MB。", invalidAvatarType: "请选择 JPEG、PNG、WebP、HEIC 或 HEIF 图片。",
    classes: "近期课程", book: "预约课程", remaining: "剩余课次",
    courseCatalog: "课程目录", courseCatalogMeta: "全部已启用场馆课程", noUpcomingSession: "暂无未来排课",
    studioUpdates: "场馆动态", studioUpdatesMeta: "最新内容与练习建议", studioShop: "场馆商城", studioShopMeta: "场馆当前在售商品",
    minutes: "分钟", capacity: "个名额", stock: "件库存",
    memberCard: "场馆会员卡", paymentMethods: "支付方式", checkIn: "到店核销",
    noData: "暂无数据", greeting: "早上好", joining: "人已预约",
    tagline: "自在流动，专注当下。", intro: "更从容地预约课程、认识教练，并管理你的瑜伽生活。",
    continueAs: "选择身份", classSocialMeta: "预约前查看谁会一起上课", paymentRegion: "全部支持的支付方式",
    classFull: "课程已满", noEligibleCard: "没有有效且未过期、课次足够的会员卡可用于该课程。",
    reserving: "正在预约...", checkingIn: "正在核销...", bookingConfirmed: "课程预约成功。", checkInComplete: "核销完成。",
    alreadyBooked: "你已预约该课程。", sessionClosed: "该课程已停止预约。",
    checkInNotEligible: "该预约当前无法核销。", requestFailed: "请求失败，请重试。", signingIn: "正在登录...",
    retry: "重试", refresh: "刷新", dataLoadFailed: "部分场馆数据加载失败，已保留此前的数据。"
  },
  ko: {
    language: "\uc5b8\uc5b4", darkMode: "\ub2e4\ud06c \ubaa8\ub4dc", lightMode: "\ub77c\uc774\ud2b8 \ubaa8\ub4dc",
    demoPassword: "\ub370\ubaa8 \ube44\ubc00\ubc88\ud638", weekStreak: "4\uc8fc \uc5f0\uc18d", yogi: "\uc694\uae30",
    todayAtGoodVibe: "\uc624\ub298\uc758 Good Vibe", teachingDay: "\uc624\ub298\uc758 \uc218\uc5c5\uc744 \ud55c\ub208\uc5d0.", sessions: "\ud69f\uc218",
    confirmed: "\ud655\uc815", arrived: "\ub3c4\ucc29", frontDesk: "\ud504\ub7f0\ud2b8 \ub370\uc2a4\ud06c", readyForArrivals: "\uccb4\ud06c\uc778 \uc900\ube44 \uc644\ub8cc",
    live: "\uc2e4\uc2dc\uac04", arrivalsMeta: "\uc608\uc57d QR \ucf54\ub4dc\ub97c \uc2a4\uce94\ud558\uac70\ub098 \uc544\ub798\uc5d0\uc11c \uc218\ub3d9\uc73c\ub85c \uccb4\ud06c\uc778\ud558\uc138\uc694.", account: "\uacc4\uc815",
    goodVibeMembership: "GOOD VIBE \uba64\ubc84\uc2ed", left: "\uc790\ub9ac \ub0a8\uc74c", waitlist: "\ub300\uae30",
    active: "\uc0ac\uc6a9 \uac00\ub2a5", frozen: "\uc77c\uc2dc \uc911\uc9c0", transferred: "\uc591\ub3c4 \uc644\ub8cc", upgraded: "\uc5c5\uadf8\ub808\uc774\ub4dc \uc644\ub8cc", expired: "\ub9cc\ub8cc",
    checkedIn: "\uccb4\ud06c\uc778 \uc644\ub8cc", cancelled: "\ucde8\uc18c", pendingPayment: "\uacb0\uc81c \ub300\uae30", waitlisted: "\ub300\uae30 \ub4f1\ub85d",
    student: "회원", coach: "강사", staff: "직원", staffSignIn: "스튜디오 운영",
    email: "이메일", password: "비밀번호", signIn: "로그인",
    logout: "로그아웃", home: "둘러보기", bookings: "예약", profile: "내 정보", privacy: "개인정보 처리방침", privacyChoices: "캘리포니아 개인정보 선택", terms: "멤버십 및 예약 약관", cancelMembership: "멤버십 취소", deleteAccount: "계정 삭제", cancelMembershipConfirm: "멤버십 취소 요청을 제출하고 자동 갱신을 중지할까요?", deleteAccountConfirm: "계정과 삭제 가능한 개인정보를 영구 삭제할까요?", requestSubmitted: "요청이 제출되었습니다.",
    changeProfilePhoto: "프로필 사진 변경", uploadingProfilePhoto: "사진 업로드 중…", avatarUpdated: "프로필 사진이 업데이트되었습니다.", avatarTooLarge: "프로필 사진은 10MB 이하여야 합니다.", invalidAvatarType: "JPEG, PNG, WebP, HEIC 또는 HEIF 이미지를 선택하세요.",
    classes: "다가오는 수업", book: "수업 예약", remaining: "남은 횟수",
    courseCatalog: "수업 카탈로그", courseCatalogMeta: "모든 활성 스튜디오 수업", noUpcomingSession: "예정된 수업이 없습니다",
    studioUpdates: "스튜디오 소식", studioUpdatesMeta: "최신 안내와 하이라이트", studioShop: "스튜디오 샵", studioShopMeta: "현재 구매 가능한 상품",
    minutes: "분", capacity: "명", stock: "개 재고",
    memberCard: "스튜디오 패스", paymentMethods: "결제 수단", checkIn: "체크인",
    noData: "아직 데이터가 없습니다", greeting: "좋은 아침이에요", joining: "명 참여",
    tagline: "잘 움직이고, 지금에 머물다.", intro: "수업 예약부터 강사와의 연결, 스튜디오 관리까지 더 차분하게.",
    continueAs: "역할 선택", classSocialMeta: "예약 전에 함께 참여하는 회원을 확인하세요", paymentRegion: "지원되는 모든 결제 수단",
    classFull: "정원 마감", noEligibleCard: "이 수업에 필요한 횟수가 남은 유효한 회원권이 없습니다.",
    reserving: "예약 중...", checkingIn: "체크인 중...", bookingConfirmed: "수업 예약이 완료되었습니다.", checkInComplete: "체크인이 완료되었습니다.",
    alreadyBooked: "이미 이 수업을 예약했습니다.", sessionClosed: "이 수업은 더 이상 예약할 수 없습니다.",
    checkInNotEligible: "이 예약은 체크인할 수 없습니다.", requestFailed: "요청에 실패했습니다. 다시 시도하세요.", signingIn: "로그인 중...",
    retry: "다시 시도", refresh: "새로고침", dataLoadFailed: "일부 스튜디오 데이터를 불러오지 못해 이전 데이터를 유지했습니다."
  }
};

const $ = (selector) => document.querySelector(selector);
const copy = (key) => messages[state.locale]?.[key] || messages.en[key] || key;

applyTheme();
boot();
window.addEventListener("focus", () => void refreshDataSilently());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refreshDataSilently();
});
window.setInterval(() => {
  if (!document.hidden) void refreshDataSilently();
}, DATA_REFRESH_INTERVAL_MS);

async function boot() {
  if (state.token) {
    try {
      const me = await api("/me");
      state.user = me.user;
      state.role = me.activeRole;
    } catch {
      clearSession();
      render();
      return;
    }
    try {
      await loadData();
    } catch (error) {
      state.dataLoadFailed = true;
      state.status = `${copy("dataLoadFailed")} ${localizePwaError(error)}`;
    }
  }
  render();
}

function render() {
  document.documentElement.lang = state.locale;
  $("#app").innerHTML = state.token ? appShell() : loginScreen();
  bind();
}

function brandHeader(meta) {
  return `
    <header class="topbar">
      <div class="brand-lockup">
        <img class="brand-logo" src="/app/assets/good-vibe-icon-192.png" alt="Good Vibe Pilates & Yoga">
        <div><p class="brand-name">Good Vibe Pilates & Yoga</p><p class="brand-meta">${escapeHtml(meta)}</p></div>
      </div>
      <div class="preferences">
        ${themeButton()}
        ${localeSelect()}
      </div>
    </header>
  `;
}

function loginScreen() {
  return `
    ${brandHeader(copy("tagline"))}
    <section class="login-intro">
      <img class="login-logo" src="/app/assets/good-vibe-logo.png" alt="Good Vibe Pilates & Yoga">
      <p class="tagline">${copy("tagline")}</p>
      <p class="intro-copy">${copy("intro")}</p>
    </section>
    <section class="surface">
      <p class="section-label">${copy("continueAs")}</p>
      <div class="role-grid">
        ${roleButton("student", copy("student"))}
        ${roleButton("coach", copy("coach"))}
      </div>
      <button class="operations-link" id="staffRole">${copy("staffSignIn")}</button>
      <div class="form-stack">
        <input id="email" type="email" autocomplete="username" aria-label="${escapeHtml(copy("email"))}" placeholder="${escapeHtml(copy("email"))}" value="${defaultEmail(state.role)}">
        <input id="password" type="password" autocomplete="current-password" aria-label="${escapeHtml(copy("password"))}" placeholder="${escapeHtml(copy("password"))}" value="GoodVibe@2026">
        <button class="primary" id="login" ${state.busy ? "disabled" : ""}>${copy(state.busy ? "signingIn" : "signIn")}</button>
        <p class="muted">${copy("demoPassword")}: GoodVibe@2026</p>
      </div>
      ${state.status ? `<p class="notice" role="alert" aria-live="assertive">${escapeHtml(state.status)}</p>` : ""}
    </section>
  `;
}

function appShell() {
  return `
    ${brandHeader(roleLabel())}
    ${state.status ? `<p class="notice app-notice" role="status" aria-live="polite">${escapeHtml(state.status)}</p>` : ""}
    <div class="sync-actions">
      <button class="secondary retry-load" id="refreshData" ${state.busy ? "disabled" : ""}>${escapeHtml(copy("refresh"))}</button>
      ${state.dataLoadFailed ? `<button class="secondary retry-load" id="retryLoad" ${state.busy ? "disabled" : ""}>${escapeHtml(copy(state.busy ? "reserving" : "retry"))}</button>` : ""}
    </div>
    ${contentForRole()}
    <nav class="bottom-nav">
      ${tabButton("home", copy("home"))}
      ${tabButton("bookings", copy("bookings"))}
      ${tabButton("profile", copy("profile"))}
    </nav>
  `;
}

function contentForRole() {
  if (state.role === "student") return studentContent();
  if (state.role === "coach") return coachContent();
  return staffContent();
}

function studentContent() {
  if (state.tab === "bookings") return bookingContent(false);
  if (state.tab === "profile") return profileContent();
  const card = bestUsableCard();
  const home = state.data.home ?? {};
  const courses = home.recommendedCourses ?? [];
  const studioContent = [...(home.banners ?? []), ...(home.features ?? []), ...(home.knowledge ?? [])];
  const products = home.storeRecommendations ?? [];
  return `
    <section class="welcome">
      <div><p class="muted">${copy("greeting")},</p><h1>${escapeHtml(state.user?.name || copy("yogi"))}</h1></div>
      <span class="status-chip">${copy("weekStreak")}</span>
    </section>
    <section class="metrics">
      ${metric(card?.remainingCredits ?? 0, copy("remaining"))}
      ${metric(state.data.availability.filter(isSessionBookable).length, copy("classes"))}
      ${metric(countUpcomingBookings(state.data.bookings), copy("bookings"))}
    </section>
    ${card ? membershipCard(card) : ""}
    <div class="section-head"><div><h2>${copy("classes")}</h2><p class="muted">${copy("classSocialMeta")}</p></div></div>
    <section class="list">${state.data.availability.map(sessionCard).join("") || empty()}</section>
    <div class="section-head"><div><h2>${copy("courseCatalog")}</h2><p class="muted">${copy("courseCatalogMeta")}</p></div></div>
    <section class="catalog-grid">${courses.map(courseCatalogCard).join("") || empty()}</section>
    ${studioContent.length ? `
      <div class="section-head"><div><h2>${copy("studioUpdates")}</h2><p class="muted">${copy("studioUpdatesMeta")}</p></div></div>
      <section class="editorial-list">${studioContent.map(contentCard).join("")}</section>
    ` : ""}
    ${products.length ? `
      <div class="section-head"><div><h2>${copy("studioShop")}</h2><p class="muted">${copy("studioShopMeta")}</p></div></div>
      <section class="catalog-grid">${products.map(productCard).join("")}</section>
    ` : ""}
  `;
}

function coachContent() {
  if (state.tab === "profile") return profileContent();
  return `
    <section class="welcome"><div><p class="muted">${copy("todayAtGoodVibe")}</p><h1>${copy("teachingDay")}</h1></div></section>
    <section class="metrics">
      ${metric(state.data.bookings.length, copy("sessions"))}
      ${metric(state.data.bookings.filter((item) => item.status === "confirmed").length, copy("confirmed"))}
      ${metric(state.data.bookings.filter((item) => item.status === "checked_in").length, copy("arrived"))}
    </section>
    <div class="section-head"><h2>${copy("bookings")}</h2></div>
    ${bookingListMarkup(false)}
  `;
}

function staffContent() {
  if (state.tab === "profile") return profileContent();
  return `
    <section class="membership">
      <div class="membership-head"><div><p class="membership-kicker">${copy("frontDesk")}</p><h2>${copy("readyForArrivals")}</h2></div><span class="pill">${copy("live")}</span></div>
      <p class="membership-muted">${copy("arrivalsMeta")}</p>
    </section>
    <div class="section-head"><h2>${copy("bookings")}</h2></div>
    ${bookingListMarkup(true)}
  `;
}

function profileContent() {
  const cancellableCard = state.data.cards.find((card) => ["active", "frozen"].includes(card.status));
  const avatarUrl = safeHttpImageUrl(state.user?.avatarUrl);
  const initials = profileInitials(state.user?.name);
  return `
    <section class="profile-card">
      <div class="profile-identity">
        <label class="profile-avatar-control ${state.avatarBusy ? "is-busy" : ""}" for="avatarFile" aria-label="${escapeHtml(copy("changeProfilePhoto"))}">
          <span class="profile-avatar" style="background:${escapeHtml(avatarColorForUser(state.user?.id))}">
            <span aria-hidden="true">${escapeHtml(initials)}</span>
            ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" onerror="this.remove()">` : ""}
          </span>
          <span class="profile-avatar-action">${escapeHtml(copy(state.avatarBusy ? "uploadingProfilePhoto" : "changeProfilePhoto"))}</span>
        </label>
        <input id="avatarFile" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" ${state.avatarBusy ? "disabled" : ""}>
        <div class="profile-copy">
          <div class="item-row"><div><p class="section-label">${copy("account")}</p><h2>${escapeHtml(state.user?.name || "")}</h2></div><span class="pill">${roleLabel()}</span></div>
          <p class="muted">${escapeHtml(state.user?.email || state.user?.phone || "")}</p>
        </div>
      </div>
    </section>
    <div class="section-head"><h2>${copy("memberCard")}</h2></div>
    <section class="list">${state.data.cards.map(membershipCard).join("") || empty()}</section>
    ${state.role === "student" ? `
      <details class="payment-disclosure">
        <summary>
          <span><strong>${copy("paymentMethods")}</strong><small>${copy("paymentRegion")}</small></span>
          <span class="disclosure-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="payment-disclosure-body">
          <section class="method-grid">${paymentMethodsForDisplay(state.data.paymentMethods).map(paymentMethod).join("")}</section>
        </div>
      </details>
    ` : ""}
    <section class="profile-card" style="margin-top:12px">
      <p><a href="/privacy" target="_blank" rel="noopener">${copy("privacy")}</a></p>
      <p><a href="/privacy-choices" target="_blank" rel="noopener">${copy("privacyChoices")}</a></p>
      <p><a href="/terms" target="_blank" rel="noopener">${copy("terms")}</a></p>
      ${cancellableCard ? `<button class="secondary" id="cancelMembership" data-card-id="${escapeHtml(cancellableCard.id)}">${copy("cancelMembership")}</button>` : ""}
      <button class="secondary" id="deleteAccount">${copy("deleteAccount")}</button>
      <button class="secondary" id="logout">${copy("logout")}</button>
    </section>
  `;
}

function membershipCard(card) {
  const percent = Math.max(0, Math.min(100, card.remainingCredits / card.totalCredits * 100));
  return `
    <section class="membership">
      <div class="membership-head"><div><p class="membership-kicker">${copy("goodVibeMembership")}</p><h2>${copy("memberCard")}</h2></div><span class="pill">${escapeHtml(statusLabel(card.status))}</span></div>
      <div class="progress"><span style="width:${percent}%"></span></div>
      <div class="membership-foot"><span>${card.remainingCredits}/${card.totalCredits} ${copy("sessions")}</span><span>${formatShortDate(card.expiresAt)}</span></div>
    </section>
  `;
}

function bookingCreditCost(session) {
  const value = Number(session.course?.memberCardDeductCount ?? session.memberCardDeductCount ?? 1);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function isEligibleCard(card, requiredCredits, now = Date.now()) {
  return card?.status === "active"
    && Number.isSafeInteger(card.remainingCredits)
    && card.remainingCredits >= requiredCredits
    && Number.isFinite(new Date(card.expiresAt).getTime())
    && new Date(card.expiresAt).getTime() > now;
}

function eligibleCardForSession(session) {
  const requiredCredits = bookingCreditCost(session);
  return state.data.cards.find((card) => isEligibleCard(card, requiredCredits));
}

function bestUsableCard() {
  return state.data.cards
    .filter((card) => isEligibleCard(card, 1))
    .sort((left, right) => right.remainingCredits - left.remainingCredits)[0];
}

function isSessionFull(session) {
  const booked = reservationCount(session);
  return booked >= Number(session.capacity || 0);
}

function reservationCount(session) {
  return Number(session.participantCount ?? session.participants?.length ?? session.bookedCount ?? 0);
}

function isSessionBookable(session, now = Date.now()) {
  const startsAt = new Date(session.startsAt).getTime();
  return session.status === "open"
    && Number.isFinite(startsAt)
    && startsAt > now
    && !isSessionFull(session);
}

function countUpcomingBookings(bookings, now = Date.now()) {
  return bookings.filter((booking) => {
    if (booking.status === "cancelled") return false;
    const endsAt = new Date(booking.endsAt ?? booking.startsAt).getTime();
    return Number.isFinite(endsAt) && endsAt > now;
  }).length;
}

function hasActiveBookingForSession(sessionId) {
  return state.data.bookings.some((booking) => booking.courseSessionId === sessionId && booking.status !== "cancelled");
}

function sessionCard(session, index) {
  const booked = reservationCount(session);
  const remaining = Math.max(0, session.capacity - booked);
  const full = isSessionFull(session);
  const hasEligibleCard = Boolean(eligibleCardForSession(session));
  const alreadyBooked = hasActiveBookingForSession(session.id);
  const bookingBusy = state.pendingBookings.has(session.id);
  const disabledReason = full ? copy("classFull") : alreadyBooked ? copy("alreadyBooked") : !hasEligibleCard ? copy("noEligibleCard") : "";
  const disabled = Boolean(disabledReason) || bookingBusy;
  const noteId = `booking-note-${String(session.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return `
    <article class="class-card ${index === 0 ? "featured" : ""}">
      <div class="date-rail"><span>${weekday(session.startsAt)}</span><strong>${dayNumber(session.startsAt)}</strong></div>
      <div class="class-body">
        ${courseImageMarkup(session.course)}
        <div class="class-head">
          <div class="class-copy"><h3>${escapeHtml(session.course?.title || session.courseId)}</h3><p class="class-meta">${formatTimeRange(session.startsAt, session.endsAt)} &middot; ${escapeHtml(session.coach?.name || session.coachId)}</p></div>
          <span class="pill">${full ? copy("classFull") : `${remaining} ${copy("left")}`}</span>
        </div>
        ${attendeeStrip(session, booked)}
        <button class="primary" data-book="${escapeHtml(session.id)}" ${disabled ? "disabled" : ""} ${disabledReason ? `aria-describedby="${noteId}"` : ""}>${copy(bookingBusy ? "reserving" : "book")}</button>
        ${disabledReason ? `<p class="action-help" id="${noteId}">${escapeHtml(disabledReason)}</p>` : ""}
      </div>
    </article>
  `;
}

function courseImageMarkup(course) {
  const imageUrl = safeHttpImageUrl(course?.imageUrl);
  if (!imageUrl) return "";
  return `<img class="course-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(course?.title || copy("classes"))}" loading="lazy">`;
}

function safeHttpImageUrl(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function courseCatalogCard(course) {
  const nextSession = state.data.availability.find((session) => session.courseId === course.id);
  const imageUrl = safeHttpImageUrl(course.imageUrl);
  return `
    <article class="catalog-card">
      ${imageUrl
        ? `<img class="catalog-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(course.title || course.id)}" loading="lazy">`
        : `<div class="catalog-placeholder" aria-hidden="true">&#9752;</div>`}
      <div class="catalog-body">
        <h3>${escapeHtml(course.title || course.id)}</h3>
        <p class="catalog-description">${escapeHtml(course.description || "")}</p>
        <p class="catalog-meta">${escapeHtml(course.durationMinutes ?? 0)} ${copy("minutes")} &middot; ${escapeHtml(course.capacity ?? 0)} ${copy("capacity")}</p>
        <p class="catalog-schedule">${nextSession ? formatDate(nextSession.startsAt) : copy("noUpcomingSession")}</p>
      </div>
    </article>
  `;
}

function contentCard(block) {
  const imageUrl = safeHttpImageUrl(block.imageUrl);
  return `
    <article class="editorial-card">
      ${imageUrl ? `<img class="editorial-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(block.title || block.id)}" loading="lazy">` : ""}
      <div class="editorial-body">
        <p class="editorial-type">${escapeHtml(block.type || "")}</p>
        <h3>${escapeHtml(block.title || block.id)}</h3>
        <p class="catalog-description">${escapeHtml(block.description || "")}</p>
      </div>
    </article>
  `;
}

function productCard(product) {
  const imageUrl = safeHttpImageUrl(product.imageUrl);
  return `
    <article class="catalog-card">
      ${imageUrl
        ? `<img class="catalog-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.title || product.id)}" loading="lazy">`
        : `<div class="catalog-placeholder" aria-hidden="true">&#9783;</div>`}
      <div class="catalog-body">
        <h3>${escapeHtml(product.title || product.id)}</h3>
        <p class="catalog-description">${escapeHtml(product.description || "")}</p>
        <div class="product-footer">
          <strong>${escapeHtml(formatAmount(product.priceAmount, product.currency))}</strong>
          <span class="pill">${escapeHtml(product.stock ?? 0)} ${copy("stock")}</span>
        </div>
      </div>
    </article>
  `;
}

function attendeeStrip(session, booked) {
  const participants = (session.participants || []).slice(0, 6);
  return `
    <div class="attendees">
      ${participants.map(attendeeAvatar).join("")}
      <span class="joining">${booked} ${copy("joining")}</span>
    </div>
  `;
}

function attendeeAvatar(person) {
  const avatarUrl = safeHttpImageUrl(person?.avatarUrl);
  return `<span class="avatar" role="img" aria-label="${escapeHtml(person?.name || copy("yogi"))}" title="${escapeHtml(person?.name || "")}" style="background:${escapeHtml(person?.color || "#6f8877")}">
    <span aria-hidden="true">${escapeHtml(person?.initials || "?")}</span>
    ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
  </span>`;
}

function profileInitials(name) {
  return String(name || copy("yogi"))
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || "?";
}

function avatarColorForUser(value) {
  const palette = ["#526f5d", "#8a6158", "#68748d", "#7a6b4f", "#6f5f82"];
  const hash = Array.from(String(value || "")).reduce((total, character) => total + character.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function bookingContent(canCheckIn) {
  return `<div class="section-head"><h2>${copy("bookings")}</h2></div>${bookingListMarkup(canCheckIn)}`;
}

function isCheckInEligible(booking) {
  return booking.status === "confirmed";
}

function bookingListMarkup(canCheckIn) {
  return `
    <section class="list">
      ${state.data.bookings.map((booking) => `
        <article class="booking-card">
          <div class="item-row"><h3>${escapeHtml(booking.course?.title || booking.courseId)}</h3><span class="pill">${escapeHtml(statusLabel(booking.status))}</span></div>
          <p class="muted">${escapeHtml(booking.user?.name || booking.coach?.name || "")}</p>
          <p>${formatDate(booking.startsAt)}</p>
          ${canCheckIn && isCheckInEligible(booking) ? `<button class="primary" data-checkin="${escapeHtml(booking.id)}" ${state.pendingCheckIns.has(booking.id) ? "disabled" : ""}>${copy(state.pendingCheckIns.has(booking.id) ? "checkingIn" : "checkIn")}</button>` : ""}
        </article>
      `).join("") || empty()}
    </section>
  `;
}

function paymentMethod(method) {
  const isInternationalCard = method.code === "card";
  const title = escapeHtml(method.display?.[state.locale] || method.display?.en || method.code);
  return `
    <article class="method${isInternationalCard ? " method-international-card" : ""}">
      <div class="method-heading">
        ${paymentMethodIcon(method.code)}
        <strong>${title}</strong>
      </div>
      ${isInternationalCard ? cardNetworkLogos() : ""}
    </article>
  `;
}

function paymentMethodsForDisplay(methods) {
  const walletCapabilities = [
    {
      code: "apple_pay",
      family: "wallet",
      display: { en: "Apple Pay", "zh-Hans": "Apple Pay", ko: "Apple Pay" }
    },
    {
      code: "google_pay",
      family: "wallet",
      display: { en: "Google Pay", "zh-Hans": "Google Pay", ko: "Google Pay" }
    }
  ].filter((capability) => !methods.some((method) => method.code === capability.code));
  const result = [...methods];
  const cardIndex = methods.findIndex((method) => method.code === "card");
  result.splice(cardIndex < 0 ? 0 : cardIndex + 1, 0, ...walletCapabilities);
  return result;
}

function paymentMethodIcon(code) {
  const assetByCode = {
    card: "card.svg",
    apple_pay: "apple-pay.svg",
    google_pay: "google-pay.svg",
    paypal: "paypal.svg",
    alipay: "alipay.svg",
    wechat_pay: "wechat-pay.svg",
    kakao_pay: "kakao-pay.svg",
    naver_pay: "naver-pay.svg",
    samsung_pay: "samsung-pay.svg",
    payco: "payco.png"
  };
  const asset = assetByCode[code] || assetByCode.card;
  return `<span class="payment-logo" aria-hidden="true"><img src="/app/assets/payment/${asset}" alt=""></span>`;
}

function cardNetworkLogos() {
  const networks = [
    ["Visa", "visa.svg"],
    ["Mastercard", "mastercard.svg"],
    ["American Express", "american-express.svg"],
    ["Discover", "discover.svg"],
    ["JCB", "jcb.svg"],
    ["Diners Club", "diners-club.svg"],
    ["UnionPay", "unionpay.svg"]
  ];
  return `
    <div class="card-networks" aria-label="Visa, Mastercard, American Express, Discover, JCB, Diners Club, and UnionPay">
      ${networks.map(([name, asset]) => `<span class="card-network" title="${name}"><img src="/app/assets/payment/${asset}" alt="${name}"></span>`).join("")}
    </div>
  `;
}

function bind() {
  $("#themeToggle")?.addEventListener("click", toggleTheme);
  $("[data-locale]")?.addEventListener("change", async (event) => {
    state.locale = event.target.value;
    localStorage.setItem("locale", state.locale);
    if (state.token) {
      try {
        await loadData();
      } catch (error) {
        state.dataLoadFailed = true;
        state.status = `${copy("dataLoadFailed")} ${localizePwaError(error)}`;
      }
    }
    render();
  });
  document.querySelectorAll("[data-role]").forEach((button) => button.addEventListener("click", () => {
    state.role = button.dataset.role;
    state.status = "";
    render();
  }));
  $("#staffRole")?.addEventListener("click", () => {
    state.role = "staff";
    render();
  });
  $("#login")?.addEventListener("click", login);
  $("#logout")?.addEventListener("click", logout);
  $("#cancelMembership")?.addEventListener("click", requestMembershipCancellation);
  $("#deleteAccount")?.addEventListener("click", deleteAccount);
  $("#avatarFile")?.addEventListener("change", (event) => uploadProfilePhoto(event.target.files?.[0]));
  $("#retryLoad")?.addEventListener("click", retryDataLoad);
  $("#refreshData")?.addEventListener("click", retryDataLoad);
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
    state.tab = button.dataset.tab;
    render();
  }));
  document.querySelectorAll("[data-book]").forEach((button) => button.addEventListener("click", () => createBooking(button.dataset.book)));
  document.querySelectorAll("[data-checkin]").forEach((button) => button.addEventListener("click", () => checkIn(button.dataset.checkin)));
}

async function login() {
  if (state.busy) return;
  const email = $("#email").value.trim().toLowerCase();
  const password = $("#password").value;
  if (!email || !password) return;
  state.busy = true;
  state.status = "";
  render();
  try {
    const response = await api("/auth/login", {
      method: "POST",
      body: { email, password, role: state.role, locale: state.locale }
    });
    state.token = response.token;
    state.user = response.user;
    state.role = response.session.activeRole;
    localStorage.setItem("token", state.token);
    localStorage.setItem("role", state.role);
    await loadData();
  } catch (error) {
    if (state.token) state.dataLoadFailed = true;
    state.status = localizePwaError(error);
  } finally {
    state.busy = false;
    render();
  }
}

async function logout() {
  try { await api("/auth/logout", { method: "POST" }); } finally { clearSession(); render(); }
}

async function uploadProfilePhoto(file) {
  if (!file || state.avatarBusy) return;
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  if (!allowedTypes.has(file.type)) {
    state.status = copy("invalidAvatarType");
    render();
    return;
  }
  if (file.size > 10_000_000) {
    state.status = copy("avatarTooLarge");
    render();
    return;
  }

  state.avatarBusy = true;
  state.status = "";
  render();
  try {
    const upload = await api("/me/avatar-upload", {
      method: "POST",
      body: { fileName: file.name, contentType: file.type, fileSize: file.size }
    });
    const uploadUrl = new URL(upload.uploadUrl, window.location.origin);
    const uploadHeaders = {
      ...(upload.headers || {}),
      "Content-Type": file.type
    };
    if (uploadUrl.origin === window.location.origin) {
      uploadHeaders.Authorization = `Bearer ${state.token}`;
    }
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: file
    });
    if (!uploadResponse.ok) {
      const failure = await uploadResponse.json().catch(() => ({}));
      const error = new Error(failure.message || failure.error || copy("requestFailed"));
      error.status = uploadResponse.status;
      error.code = failure.error || "upload_failed";
      throw error;
    }
    state.user = await api("/me/avatar", {
      method: "PATCH",
      body: { objectKey: upload.objectKey }
    });
    state.status = copy("avatarUpdated");
  } catch (error) {
    state.status = localizePwaError(error);
  } finally {
    state.avatarBusy = false;
    render();
  }
}

async function requestMembershipCancellation(event) {
  const cardId = event.currentTarget.dataset.cardId;
  if (!cardId || !window.confirm(copy("cancelMembershipConfirm"))) return;
  try {
    await api(`/member-cards/${encodeURIComponent(cardId)}/cancel-request`, { method: "POST", body: { reason: "user_request" } });
    state.status = copy("requestSubmitted");
    await loadData();
    render();
  } catch (error) {
    state.status = localizePwaError(error);
    render();
  }
}

async function deleteAccount() {
  if (!window.confirm(copy("deleteAccountConfirm"))) return;
  try {
    await api("/privacy/account-deletion", { method: "POST" });
    clearSession();
  } catch (error) {
    state.status = localizePwaError(error);
  }
  render();
}

async function createBooking(sessionId) {
  if (state.pendingBookings.has(sessionId)) return;
  const session = state.data.availability.find((item) => item.id === sessionId);
  if (!session) return;
  if (isSessionFull(session)) {
    state.status = copy("classFull");
    render();
    return;
  }
  if (hasActiveBookingForSession(sessionId)) {
    state.status = copy("alreadyBooked");
    render();
    return;
  }
  if (!eligibleCardForSession(session)) {
    state.status = copy("noEligibleCard");
    render();
    return;
  }
  state.pendingBookings.add(sessionId);
  state.status = "";
  render();
  let bookingCreated = false;
  try {
    await api("/bookings", {
      method: "POST",
      idempotencyKey: crypto.randomUUID(),
      body: { courseSessionId: sessionId, paymentMode: "member_card" }
    });
    bookingCreated = true;
    await loadData();
    state.status = copy("bookingConfirmed");
  } catch (error) {
    if (bookingCreated) state.dataLoadFailed = true;
    state.status = bookingCreated
      ? `${copy("bookingConfirmed")} ${copy("dataLoadFailed")}`
      : localizePwaError(error);
  } finally {
    state.pendingBookings.delete(sessionId);
    render();
  }
}

async function checkIn(bookingId) {
  if (state.pendingCheckIns.has(bookingId)) return;
  const booking = state.data.bookings.find((item) => item.id === bookingId);
  if (!booking || !isCheckInEligible(booking)) {
    state.status = copy("checkInNotEligible");
    render();
    return;
  }
  state.pendingCheckIns.add(bookingId);
  state.status = "";
  render();
  let checkInCompleted = false;
  try {
    await api(`/bookings/${bookingId}/check-in`, { method: "POST", body: { method: "manual" } });
    checkInCompleted = true;
    await loadData();
    state.status = copy("checkInComplete");
  } catch (error) {
    if (checkInCompleted) state.dataLoadFailed = true;
    state.status = checkInCompleted
      ? `${copy("checkInComplete")} ${copy("dataLoadFailed")}`
      : localizePwaError(error);
  } finally {
    state.pendingCheckIns.delete(bookingId);
    render();
  }
}

async function loadData() {
  const [home, availability, bookings, cards, paymentMethods] = await Promise.all([
    api(`/home?locale=${state.locale}`),
    api(`/availability?locale=${state.locale}`),
    api(`/bookings?locale=${state.locale}`),
    api("/member-cards"),
    api("/payments/methods?scope=all")
  ]);
  state.data = { home, availability, bookings, cards, paymentMethods };
  state.dataLoadFailed = false;
}

async function refreshDataSilently() {
  if (!state.token || state.busy || dataRefreshPromise) return dataRefreshPromise;
  dataRefreshPromise = loadData()
    .then(() => {
      state.status = "";
      render();
    })
    .catch((error) => {
      state.dataLoadFailed = true;
      state.status = `${copy("dataLoadFailed")} ${localizePwaError(error)}`;
      render();
    })
    .finally(() => {
      dataRefreshPromise = null;
    });
  return dataRefreshPromise;
}

async function retryDataLoad() {
  if (state.busy || !state.token) return;
  state.busy = true;
  state.status = "";
  render();
  try {
    await loadData();
  } catch (error) {
    state.dataLoadFailed = true;
    state.status = `${copy("dataLoadFailed")} ${localizePwaError(error)}`;
  } finally {
    state.busy = false;
    render();
  }
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    const error = new Error(copy("requestFailed"));
    error.status = 0;
    error.code = "network_error";
    throw error;
  }
  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error(copy("requestFailed"));
    error.status = response.status;
    error.code = "invalid_response";
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.message || data.error || copy("requestFailed"));
    error.status = response.status;
    error.code = data.error || "";
    throw error;
  }
  return data;
}

function localizePwaError(error) {
  const key = {
    session_full: "classFull",
    no_active_card: "noEligibleCard",
    insufficient_credits: "noEligibleCard",
    duplicate_booking: "alreadyBooked",
    session_closed: "sessionClosed",
    not_checkin_eligible: "checkInNotEligible",
    invalid_avatar_type: "invalidAvatarType",
    avatar_too_large: "avatarTooLarge",
    network_error: "requestFailed"
  }[error?.code];
  return key ? copy(key) : error?.message || copy("requestFailed");
}

function clearSession() {
  state.token = "";
  state.user = null;
  state.role = "student";
  state.avatarBusy = false;
  state.status = "";
  state.dataLoadFailed = false;
  state.pendingBookings.clear();
  state.pendingCheckIns.clear();
  localStorage.removeItem("token");
  localStorage.removeItem("role");
}

function roleButton(role, label) {
  return `<button class="role-choice ${role === state.role ? "active" : ""}" data-role="${role}" aria-pressed="${role === state.role}">${label}</button>`;
}

function tabButton(tab, label) {
  return `<button class="${state.tab === tab ? "active" : ""}" data-tab="${tab}" ${state.tab === tab ? 'aria-current="page"' : ""}>${label}</button>`;
}

function metric(value, label) {
  return `<article class="metric"><strong>${value}</strong><span>${escapeHtml(label)}</span></article>`;
}

function themeButton() {
  const label = copy(state.theme === "dark" ? "lightMode" : "darkMode");
  const icon = state.theme === "dark" ? "&#9788;" : "&#9790;";
  return `<button class="theme-toggle" id="themeToggle" type="button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${icon}</button>`;
}

function localeSelect() {
  return `<select class="locale" data-locale aria-label="${escapeHtml(copy("language"))}">
    <option value="en" ${state.locale === "en" ? "selected" : ""}>EN</option>
    <option value="zh-Hans" ${state.locale === "zh-Hans" ? "selected" : ""}>中文</option>
    <option value="ko" ${state.locale === "ko" ? "selected" : ""}>한국어</option>
  </select>`;
}

function roleLabel() {
  return state.role === "coach" ? copy("coach") : state.role === "staff" ? copy("staff") : copy("student");
}

function statusLabel(status) {
  const key = {
    active: "active",
    frozen: "frozen",
    transferred: "transferred",
    upgraded: "upgraded",
    expired: "expired",
    confirmed: "confirmed",
    checked_in: "checkedIn",
    cancelled: "cancelled",
    pending_payment: "pendingPayment",
    waitlisted: "waitlisted"
  }[status];
  return key ? copy(key) : String(status || "").replaceAll("_", " ");
}

function defaultEmail(role) {
  if (role === "coach") return "coach@example.com";
  if (role === "staff") return "staff@example.com";
  return "student@example.com";
}

function preferredLocale() {
  const language = navigator.language || "en";
  if (language.startsWith("ko")) return "ko";
  if (language.startsWith("zh")) return "zh-Hans";
  return "en";
}

function preferredTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function preferredPaymentRegion() {
  return paymentRegionForLocales([
    ...Array.from(navigator.languages || []),
    navigator.language
  ]);
}

function paymentRegionForLocales(localeValues) {
  const currencyByRegion = {
    AU: "AUD", CA: "CAD", CH: "CHF", CN: "CNY", CZ: "CZK", DK: "DKK",
    GB: "GBP", HK: "HKD", JP: "JPY", KR: "KRW", MY: "MYR", NO: "NOK",
    NZ: "NZD", PL: "PLN", SE: "SEK", SG: "SGD", US: "USD"
  };
  const euroRegions = new Set([
    "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR",
    "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"
  ]);

  let inferredCountry;
  for (const value of localeValues) {
    if (!value) continue;
    try {
      const locale = new Intl.Locale(value);
      if (locale.region) {
        inferredCountry = locale.region;
        break;
      }
      inferredCountry ||= locale.maximize().region;
    } catch {
      // Ignore malformed browser locale values and continue to the fallback.
    }
  }

  if (!inferredCountry) return { country: "US", currency: "USD" };
  return {
    country: inferredCountry,
    currency: currencyByRegion[inferredCountry] || (euroRegions.has(inferredCountry) ? "EUR" : "USD")
  };
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, state.theme);
  applyTheme();
  render();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    state.theme === "dark" ? "#111613" : "#f7f6f2"
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat(state.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatAmount(amount, currency = "USD") {
  const numericAmount = Number(amount ?? 0) / 100;
  try {
    return new Intl.NumberFormat(state.locale, { style: "currency", currency }).format(numericAmount);
  } catch {
    return `${currency} ${numericAmount.toFixed(2)}`;
  }
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat(state.locale, { month: "short", day: "numeric" }).format(new Date(value));
}

function formatTimeRange(start, end) {
  const formatter = new Intl.DateTimeFormat(state.locale, { hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(start))} \u2013 ${formatter.format(new Date(end))}`;
}

function weekday(value) {
  return new Intl.DateTimeFormat(state.locale, { weekday: "short" }).format(new Date(value)).toUpperCase();
}

function dayNumber(value) {
  return String(new Date(value).getDate()).padStart(2, "0");
}

function empty() {
  return `<p class="muted">${copy("noData")}</p>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}
