const state = {
  token: localStorage.getItem("token") || "",
  role: localStorage.getItem("role") || "student",
  locale: localStorage.getItem("locale") || preferredLocale(),
  user: null,
  tab: "home",
  busy: false,
  status: "",
  data: { home: null, availability: [], bookings: [], cards: [], paymentMethods: [] }
};

const messages = {
  en: {
    student: "Student", coach: "Coach", staff: "Staff", staffSignIn: "Studio operations",
    email: "Email", password: "Password", signIn: "Sign in",
    logout: "Sign out", home: "Discover", bookings: "Bookings", profile: "Profile",
    classes: "Upcoming classes", book: "Reserve class", remaining: "Credits left",
    memberCard: "Studio Pass", paymentMethods: "Payment methods", checkIn: "Check in",
    noData: "Nothing here yet", greeting: "Good morning", joining: "joining",
    tagline: "Move well. Feel present.", intro: "A calmer way to book classes, meet your coach, and manage the studio.",
    continueAs: "Continue as", classSocialMeta: "See who is joining before you book", paymentRegion: "Available for your region"
  },
  "zh-Hans": {
    student: "学员", coach: "教练", staff: "员工", staffSignIn: "场馆运营",
    email: "邮箱", password: "密码", signIn: "登录",
    logout: "退出登录", home: "发现", bookings: "预约", profile: "我的",
    classes: "近期课程", book: "预约课程", remaining: "剩余课次",
    memberCard: "场馆会员卡", paymentMethods: "支付方式", checkIn: "到店核销",
    noData: "暂无数据", greeting: "早上好", joining: "人已预约",
    tagline: "自在流动，专注当下。", intro: "更从容地预约课程、认识教练，并管理你的瑜伽生活。",
    continueAs: "选择身份", classSocialMeta: "预约前查看谁会一起上课", paymentRegion: "当前地区可用"
  },
  ko: {
    student: "회원", coach: "강사", staff: "직원", staffSignIn: "스튜디오 운영",
    email: "이메일", password: "비밀번호", signIn: "로그인",
    logout: "로그아웃", home: "둘러보기", bookings: "예약", profile: "내 정보",
    classes: "다가오는 수업", book: "수업 예약", remaining: "남은 횟수",
    memberCard: "스튜디오 패스", paymentMethods: "결제 수단", checkIn: "체크인",
    noData: "아직 데이터가 없습니다", greeting: "좋은 아침이에요", joining: "명 참여",
    tagline: "잘 움직이고, 지금에 머물다.", intro: "수업 예약부터 강사와의 연결, 스튜디오 관리까지 더 차분하게.",
    continueAs: "역할 선택", classSocialMeta: "예약 전에 함께 참여하는 회원을 확인하세요", paymentRegion: "현재 지역에서 사용 가능"
  }
};

const $ = (selector) => document.querySelector(selector);
const copy = (key) => messages[state.locale]?.[key] || messages.en[key] || key;

boot();

async function boot() {
  if (state.token) {
    try {
      const me = await api("/me");
      state.user = me.user;
      state.role = me.activeRole;
      await loadData();
    } catch {
      clearSession();
    }
  }
  render();
}

function render() {
  $("#app").innerHTML = state.token ? appShell() : loginScreen();
  bind();
}

function brandHeader(meta) {
  return `
    <header class="topbar">
      <div class="brand-lockup">
        <img class="brand-logo" src="/app/assets/yomi-icon-192.png" alt="Yomi Yoga">
        <div><p class="brand-name">Yomi Yoga</p><p class="brand-meta">${escapeHtml(meta)}</p></div>
      </div>
      ${localeSelect()}
    </header>
  `;
}

function loginScreen() {
  return `
    ${brandHeader(copy("tagline"))}
    <section class="login-intro">
      <img class="login-logo" src="/app/assets/yomi-icon-192.png" alt="">
      <h1>Yomi Yoga</h1>
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
        <input id="email" type="email" autocomplete="username" aria-label="Email" placeholder="Email" value="${defaultEmail(state.role)}">
        <input id="password" type="password" autocomplete="current-password" aria-label="Password" placeholder="Password" value="Yomi@2026">
        <button class="primary" id="login" ${state.busy ? "disabled" : ""}>${copy("signIn")}</button>
        <p class="muted">Demo password: Yomi@2026</p>
      </div>
      ${state.status ? `<p class="notice">${escapeHtml(state.status)}</p>` : ""}
    </section>
  `;
}

function appShell() {
  return `
    ${brandHeader(roleLabel())}
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
  const card = state.data.cards[0];
  return `
    <section class="welcome">
      <div><p class="muted">${copy("greeting")},</p><h1>${escapeHtml(state.user?.name || "Yogi")}</h1></div>
      <span class="status-chip">4 week streak</span>
    </section>
    <section class="metrics">
      ${metric(card?.remainingCredits ?? 0, copy("remaining"))}
      ${metric(state.data.availability.length, copy("classes"))}
      ${metric(state.data.bookings.length, copy("bookings"))}
    </section>
    ${card ? membershipCard(card) : ""}
    <div class="section-head"><div><h2>${copy("classes")}</h2><p class="muted">${copy("classSocialMeta")}</p></div></div>
    <section class="list">${state.data.availability.map(sessionCard).join("") || empty()}</section>
    <div class="section-head"><div><h2>${copy("paymentMethods")}</h2><p class="muted">${copy("paymentRegion")}</p></div></div>
    <section class="method-grid">${state.data.paymentMethods.map(paymentMethod).join("")}</section>
  `;
}

function coachContent() {
  if (state.tab === "profile") return profileContent();
  return `
    <section class="welcome"><div><p class="muted">Today at Yomi</p><h1>Your teaching day.</h1></div></section>
    <section class="metrics">
      ${metric(state.data.bookings.length, "Sessions")}
      ${metric(state.data.bookings.filter((item) => item.status === "confirmed").length, "Confirmed")}
      ${metric(state.data.bookings.filter((item) => item.status === "checked_in").length, "Arrived")}
    </section>
    <div class="section-head"><h2>${copy("bookings")}</h2></div>
    ${bookingListMarkup(false)}
  `;
}

function staffContent() {
  if (state.tab === "profile") return profileContent();
  return `
    <section class="membership">
      <div class="membership-head"><div><p class="membership-kicker">FRONT DESK</p><h2>Ready for arrivals</h2></div><span class="pill">Live</span></div>
      <p class="muted">Scan a booking QR code or use manual check-in below.</p>
    </section>
    <div class="section-head"><h2>${copy("bookings")}</h2></div>
    ${bookingListMarkup(true)}
  `;
}

function profileContent() {
  return `
    <section class="profile-card">
      <div class="item-row"><div><p class="section-label">Account</p><h2>${escapeHtml(state.user?.name || "")}</h2></div><span class="pill">${escapeHtml(state.role)}</span></div>
      <p class="muted">${escapeHtml(state.user?.email || state.user?.phone || "")}</p>
    </section>
    <div class="section-head"><h2>${copy("memberCard")}</h2></div>
    <section class="list">${state.data.cards.map(membershipCard).join("") || empty()}</section>
    <section class="profile-card" style="margin-top:12px"><button class="secondary" id="logout">${copy("logout")}</button></section>
  `;
}

function membershipCard(card) {
  const percent = Math.max(0, Math.min(100, card.remainingCredits / card.totalCredits * 100));
  return `
    <section class="membership">
      <div class="membership-head"><div><p class="membership-kicker">YOMI MEMBERSHIP</p><h2>${copy("memberCard")}</h2></div><span class="pill">${escapeHtml(card.status)}</span></div>
      <div class="progress"><span style="width:${percent}%"></span></div>
      <div class="membership-foot"><span>${card.remainingCredits}/${card.totalCredits} sessions</span><span>${formatShortDate(card.expiresAt)}</span></div>
    </section>
  `;
}

function sessionCard(session, index) {
  const booked = session.participantCount ?? session.participants?.length ?? session.bookedCount ?? 0;
  const remaining = Math.max(0, session.capacity - booked);
  return `
    <article class="class-card ${index === 0 ? "featured" : ""}">
      <div class="date-rail"><span>${weekday(session.startsAt)}</span><strong>${dayNumber(session.startsAt)}</strong></div>
      <div class="class-body">
        <div class="class-head">
          <div class="class-copy"><h3>${escapeHtml(session.course?.title || session.courseId)}</h3><p class="class-meta">${formatTimeRange(session.startsAt, session.endsAt)} · ${escapeHtml(session.coach?.name || session.coachId)}</p></div>
          <span class="pill">${remaining ? `${remaining} left` : "waitlist"}</span>
        </div>
        ${attendeeStrip(session, booked)}
        <button class="primary" data-book="${session.id}">${copy("book")}</button>
      </div>
    </article>
  `;
}

function attendeeStrip(session, booked) {
  const participants = (session.participants || []).slice(0, 6);
  return `
    <div class="attendees">
      ${participants.map((person) => `<span class="avatar" title="${escapeHtml(person.name)}" style="background:${escapeHtml(person.color || "#6f8877")}">${escapeHtml(person.initials || "?")}</span>`).join("")}
      <span class="joining">${booked} ${copy("joining")}</span>
    </div>
  `;
}

function bookingContent(canCheckIn) {
  return `<div class="section-head"><h2>${copy("bookings")}</h2></div>${bookingListMarkup(canCheckIn)}`;
}

function bookingListMarkup(canCheckIn) {
  return `
    <section class="list">
      ${state.data.bookings.map((booking) => `
        <article class="booking-card">
          <div class="item-row"><h3>${escapeHtml(booking.course?.title || booking.courseId)}</h3><span class="pill">${escapeHtml(booking.status)}</span></div>
          <p class="muted">${escapeHtml(booking.user?.name || booking.coach?.name || "")}</p>
          <p>${formatDate(booking.startsAt)}</p>
          ${canCheckIn && booking.status !== "checked_in" ? `<button class="primary" data-checkin="${booking.id}">${copy("checkIn")}</button>` : ""}
        </article>
      `).join("") || empty()}
    </section>
  `;
}

function paymentMethod(method) {
  return `<article class="method"><strong>${escapeHtml(method.display?.[state.locale] || method.display?.en || method.code)}</strong><small>${escapeHtml(method.code)}</small></article>`;
}

function bind() {
  $("[data-locale]")?.addEventListener("change", async (event) => {
    state.locale = event.target.value;
    localStorage.setItem("locale", state.locale);
    if (state.token) await loadData();
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
    state.status = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

async function logout() {
  try { await api("/auth/logout", { method: "POST" }); } finally { clearSession(); render(); }
}

async function createBooking(sessionId) {
  try {
    await api("/bookings", {
      method: "POST",
      idempotencyKey: crypto.randomUUID(),
      body: { courseSessionId: sessionId, paymentMode: "member_card" }
    });
    await loadData();
  } catch (error) {
    state.status = error.message;
  }
  render();
}

async function checkIn(bookingId) {
  await api(`/bookings/${bookingId}/check-in`, { method: "POST", body: { method: "manual" } });
  await loadData();
  render();
}

async function loadData() {
  const country = state.locale === "ko" ? "KR" : "HK";
  const currency = state.locale === "ko" ? "KRW" : "HKD";
  const [home, availability, bookings, cards, paymentMethods] = await Promise.all([
    api(`/home?locale=${state.locale}`),
    api(`/availability?locale=${state.locale}`),
    api(`/bookings?locale=${state.locale}`).catch(() => []),
    api("/member-cards").catch(() => []),
    api(`/payments/methods?country=${country}&currency=${currency}`)
  ]);
  state.data = { home, availability, bookings, cards, paymentMethods };
}

async function api(path, options = {}) {
  const response = await fetch(`/api/v1${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

function clearSession() {
  state.token = "";
  state.user = null;
  state.role = "student";
  localStorage.removeItem("token");
  localStorage.removeItem("role");
}

function roleButton(role, label) {
  return `<button class="role-choice ${role === state.role ? "active" : ""}" data-role="${role}">${label}</button>`;
}

function tabButton(tab, label) {
  return `<button class="${state.tab === tab ? "active" : ""}" data-tab="${tab}">${label}</button>`;
}

function metric(value, label) {
  return `<article class="metric"><strong>${value}</strong><span>${escapeHtml(label)}</span></article>`;
}

function localeSelect() {
  return `<select class="locale" data-locale aria-label="Language">
    <option value="en" ${state.locale === "en" ? "selected" : ""}>EN</option>
    <option value="zh-Hans" ${state.locale === "zh-Hans" ? "selected" : ""}>中文</option>
    <option value="ko" ${state.locale === "ko" ? "selected" : ""}>한국어</option>
  </select>`;
}

function roleLabel() {
  return state.role === "coach" ? copy("coach") : state.role === "staff" ? copy("staff") : copy("student");
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

function formatDate(value) {
  return new Intl.DateTimeFormat(state.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat(state.locale, { month: "short", day: "numeric" }).format(new Date(value));
}

function formatTimeRange(start, end) {
  const formatter = new Intl.DateTimeFormat(state.locale, { hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
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
